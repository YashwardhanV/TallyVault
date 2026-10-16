package com.tallyvault.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountRepository;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.AuthDtos;
import com.tallyvault.auth.User;
import com.tallyvault.auth.UserRepository;
import com.tallyvault.common.ApiException;
import com.tallyvault.ledger.LedgerEntryRepository;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransaction;
import com.tallyvault.transaction.LedgerTransactionRepository;
import com.tallyvault.transaction.ReversalService;
import com.tallyvault.transaction.TransactionStatus;
import com.tallyvault.transaction.TransactionType;
import com.tallyvault.transfer.IdempotencyRecordRepository;
import com.tallyvault.transfer.TransferDtos;
import com.tallyvault.transfer.TransferService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "tallyvault.demo-data-enabled=false")
@Testcontainers
@AutoConfigureMockMvc
class LedgerCriticalPathsIntegrationTest {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired UserRepository users;
    @Autowired AccountRepository accounts;
    @Autowired LedgerTransactionRepository transactions;
    @Autowired LedgerEntryRepository entries;
    @Autowired IdempotencyRecordRepository idempotency;
    @Autowired LedgerPostingService ledger;
    @Autowired TransferService transfers;
    @Autowired ReversalService reversals;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    User alice;
    User bob;
    Account aliceAccount;
    Account bobAccount;
    Account equity;

    @BeforeEach
    void setUp() {
        jdbc.execute("TRUNCATE idempotency_records, ledger_entries, ledger_transactions, accounts, app_users CASCADE");
        tx.executeWithoutResult(status -> {
            User admin = users.save(new User("admin@test.dev", "hash", "Admin", Role.ADMIN));
            alice = users.save(new User("alice@test.dev", "hash", "Alice", Role.USER));
            bob = users.save(new User("bob@test.dev", "hash", "Bob", Role.USER));
            equity = accounts.save(new Account(admin, "SYSTEM", "Equity", "INR", true));
            aliceAccount = accounts.save(new Account(alice, "ALICE", "Alice wallet", "INR", false));
            bobAccount = accounts.save(new Account(bob, "BOB", "Bob wallet", "INR", false));
            fund(equity, aliceAccount, new BigDecimal("1000.00"));
            fund(equity, bobAccount, new BigDecimal("1000.00"));
        });
    }

    @AfterEach
    void clear() {
        jdbc.execute("TRUNCATE idempotency_records, ledger_entries, ledger_transactions, accounts, app_users CASCADE");
    }

    @Test
    void successfulTransferIsBalancedAndBalanceCacheReconciles() {
        var result = transfers.transfer("balanced-1", request(aliceAccount, bobAccount, "250.00"), alice);
        assertThat(result.entries()).hasSize(2);
        assertThat(result.entries().get(0).amount()).isEqualByComparingTo(result.entries().get(1).amount());
        assertThat(unbalancedCompletedTransactions()).isZero();
        assertThat(balance(aliceAccount)).isEqualByComparingTo("750.00");
        assertThat(entries.calculateBalance(aliceAccount.getId())).isEqualByComparingTo("750.00");
    }

    @Test
    void failureAfterIdempotencyClaimRollsBackEveryRow() {
        long transactionCount = transactions.count();
        long keyCount = idempotency.count();
        UUID missing = UUID.randomUUID();
        var bad = new TransferDtos.TransferRequest(aliceAccount.getId(), missing,
            new BigDecimal("10.00"), "missing destination");

        assertThatThrownBy(() -> transfers.transfer("rollback-1", bad, alice))
            .isInstanceOf(ApiException.class).hasMessageContaining("not found");

        assertThat(transactions.count()).isEqualTo(transactionCount);
        assertThat(idempotency.count()).isEqualTo(keyCount);
        assertThat(balance(aliceAccount)).isEqualByComparingTo("1000.00");
    }

    @Test
    void concurrentOverspendingAllowsExactlyOneTransfer() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            int n = i;
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    transfers.transfer("overspend-" + n, request(aliceAccount, bobAccount, "800.00"), alice);
                    return true;
                } catch (ApiException rejected) {
                    return false;
                }
            }));
        }
        start.countDown();
        int successes = 0;
        for (Future<Boolean> future : futures) if (future.get(15, TimeUnit.SECONDS)) successes++;
        pool.shutdownNow();

        assertThat(successes).isEqualTo(1);
        assertThat(balance(aliceAccount)).isEqualByComparingTo("200.00");
        assertThat(unbalancedCompletedTransactions()).isZero();
    }

    @Test
    void concurrentDuplicateKeysCreateOneLogicalTransaction() throws Exception {
        long before = transactions.count();
        ExecutorService pool = Executors.newFixedThreadPool(10);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<UUID>> futures = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                return transfers.transfer("same-key", request(aliceAccount, bobAccount, "50.00"), alice)
                    .transactionId();
            }));
        }
        start.countDown();
        Set<UUID> returned = new HashSet<>();
        for (Future<UUID> future : futures) returned.add(future.get(20, TimeUnit.SECONDS));
        pool.shutdownNow();

        assertThat(returned).hasSize(1);
        assertThat(transactions.count() - before).isEqualTo(1);
        assertThat(idempotency.count()).isEqualTo(1);
        assertThat(balance(aliceAccount)).isEqualByComparingTo("950.00");
    }

    @Test
    void threeSequentialRetriesReplayOneTransactionAndChangedPayloadConflicts() {
        long before = transactions.count();
        var first = transfers.transfer("retry-three", request(aliceAccount, bobAccount, "25.00"), alice);
        var second = transfers.transfer("retry-three", request(aliceAccount, bobAccount, "25.00"), alice);
        var third = transfers.transfer("retry-three", request(aliceAccount, bobAccount, "25.00"), alice);

        assertThat(new HashSet<>(List.of(first.transactionId(), second.transactionId(), third.transactionId()))).hasSize(1);
        assertThat(second.replayed()).isTrue();
        assertThat(third.replayed()).isTrue();
        assertThat(transactions.count() - before).isEqualTo(1);
        assertThat(balance(aliceAccount)).isEqualByComparingTo("975.00");

        assertThatThrownBy(() -> transfers.transfer(
            "retry-three", request(aliceAccount, bobAccount, "26.00"), alice))
            .isInstanceOf(ApiException.class).hasMessageContaining("different request");
        assertThat(transactions.count() - before).isEqualTo(1);
    }

    @Test
    void oppositeDirectionTransfersUseOneLockOrderAndFinishWithoutDeadlock() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            int n = i;
            futures.add(pool.submit(() -> {
                start.await();
                if (n % 2 == 0) transfers.transfer("opposite-a-" + n,
                    request(aliceAccount, bobAccount, "10.00"), alice);
                else transfers.transfer("opposite-b-" + n,
                    request(bobAccount, aliceAccount, "10.00"), bob);
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) future.get(30, TimeUnit.SECONDS);
        pool.shutdownNow();
        assertThat(balance(aliceAccount)).isEqualByComparingTo("1000.00");
        assertThat(balance(bobAccount)).isEqualByComparingTo("1000.00");
        assertThat(unbalancedCompletedTransactions()).isZero();
    }

    @Test
    void reversalKeepsOriginalImmutableAndAddsBalancedCompensation() {
        UUID originalId = transfers.transfer("to-reverse", request(aliceAccount, bobAccount, "500.00"), alice)
            .transactionId();
        var before = transactions.findDetailedById(originalId).orElseThrow();
        List<UUID> beforeEntries = before.getEntries().stream().map(entry -> entry.getId()).sorted().toList();

        var reversal = reversals.reverse(originalId, "operator correction");
        var after = transactions.findDetailedById(originalId).orElseThrow();

        assertThat(after.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        assertThat(after.getEntries().stream().map(entry -> entry.getId()).sorted().toList())
            .containsExactlyElementsOf(beforeEntries);
        assertThat(reversal.reversalOfTransactionId()).isEqualTo(originalId);
        assertThat(balance(aliceAccount)).isEqualByComparingTo("1000.00");
        assertThat(balance(bobAccount)).isEqualByComparingTo("1000.00");
        assertThat(unbalancedCompletedTransactions()).isZero();
    }

    @Test
    void concurrentReversalCreatesOnlyOneCompensatingTransaction() throws Exception {
        UUID originalId = transfers.transfer("reverse-race-transfer",
            request(aliceAccount, bobAccount, "100.00"), alice).transactionId();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    reversals.reverse(originalId, "concurrent correction");
                    return true;
                } catch (ApiException rejected) {
                    return false;
                }
            }));
        }
        start.countDown();
        int successes = 0;
        for (Future<Boolean> future : futures) if (future.get(15, TimeUnit.SECONDS)) successes++;
        pool.shutdownNow();
        assertThat(successes).isEqualTo(1);
        assertThat(transactions.existsByReversalOfId(originalId)).isTrue();
    }

    @Test
    void databaseRejectsUnbalancedCompletionAndLedgerMutation() {
        long before = transactions.count();
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            UUID transactionId = UUID.randomUUID();
            jdbc.update("insert into ledger_transactions(id, transaction_type, status, reference, created_at) "
                + "values (?, 'TRANSFER', 'PROCESSING', 'direct SQL test', now())", transactionId);
            jdbc.update("insert into ledger_entries(id, transaction_id, account_id, entry_type, amount, created_at) "
                + "values (?, ?, ?, 'DEBIT', 10.00, now())", UUID.randomUUID(), transactionId, aliceAccount.getId());
            jdbc.update("update ledger_transactions set status='COMPLETED', completed_at=now() where id=?", transactionId);
        })).isInstanceOf(RuntimeException.class);
        assertThat(transactions.count()).isEqualTo(before);

        UUID valid = transfers.transfer("immutable-1", request(aliceAccount, bobAccount, "10.00"), alice)
            .transactionId();
        UUID entryId = transactions.findDetailedById(valid).orElseThrow().getEntries().get(0).getId();
        assertThatThrownBy(() -> jdbc.update("update ledger_entries set amount=11.00 where id=?", entryId))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void restAuthenticationAndOwnershipAreEnforced() throws Exception {
        String firstToken = registerThroughApi("first@api.test", "First User");
        String secondToken = registerThroughApi("second@api.test", "Second User");

        String firstAccountJson = mvc.perform(post("/accounts")
                .header("Authorization", "Bearer " + firstToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"First wallet\",\"currency\":\"INR\"}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID firstAccountId = UUID.fromString(json.readTree(firstAccountJson).get("id").asText());

        mvc.perform(get("/accounts/" + firstAccountId)
                .header("Authorization", "Bearer " + secondToken))
            .andExpect(status().isForbidden());
        mvc.perform(get("/transactions").header("Authorization", "Bearer " + firstToken))
            .andExpect(status().isForbidden());
        mvc.perform(get("/accounts/" + firstAccountId)
                .header("Authorization", "Bearer " + firstToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accountNumber").isNotEmpty());
    }

    private void fund(Account source, Account destination, BigDecimal amount) {
        LedgerTransaction transaction = new LedgerTransaction(TransactionType.FUNDING, "test funding", null);
        transactions.save(transaction);
        ledger.postTwoLeggedTransfer(transaction, source, destination, amount);
        transaction.complete();
        transactions.save(transaction);
    }

    private TransferDtos.TransferRequest request(Account source, Account destination, String amount) {
        return new TransferDtos.TransferRequest(source.getId(), destination.getId(), new BigDecimal(amount), "test");
    }

    private BigDecimal balance(Account account) {
        return accounts.findById(account.getId()).orElseThrow().getCachedBalance();
    }

    private int unbalancedCompletedTransactions() {
        return jdbc.queryForObject("""
            select count(*) from (
              select t.id
                from ledger_transactions t join ledger_entries e on e.transaction_id=t.id
               where t.status='COMPLETED'
               group by t.id
              having sum(e.amount) filter (where e.entry_type='DEBIT')
                   <> sum(e.amount) filter (where e.entry_type='CREDIT')
            ) invalid
            """, Integer.class);
    }


    private String registerThroughApi(String email, String name) throws Exception {
        String body = json.writeValueAsString(new AuthDtos.RegisterRequest(email, "Password123!", name));
        String response = mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.token").isNotEmpty())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }
}
