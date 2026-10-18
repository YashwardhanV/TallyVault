package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tallyvault.account.Account;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.common.ApiException;
import com.tallyvault.ledger.EntryType;
import com.tallyvault.ledger.LedgerEntry;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransaction;
import com.tallyvault.transaction.LedgerTransactionRepository;
import com.tallyvault.transaction.ReversalService;
import com.tallyvault.transaction.TransactionType;
import com.tallyvault.transfer.AccountLockService;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReversalServiceTest {
    @Mock LedgerTransactionRepository transactions;
    @Mock AccountLockService locks;
    @Mock LedgerPostingService ledger;
    ReversalService service;
    LedgerTransaction original;
    Account source;
    Account receiver;

    @BeforeEach void setUp() {
        service = new ReversalService(transactions, locks, ledger);
        User owner = new User("owner@example.com", "hash", "Owner", Role.USER);
        source = new Account(owner, "SOURCE", "Source", "INR", false);
        receiver = new Account(owner, "RECEIVER", "Receiver", "INR", false);
        receiver.credit(new BigDecimal("100.00"));
        original = new LedgerTransaction(TransactionType.TRANSFER, "original", null);
        original.addEntry(new LedgerEntry(original, source, EntryType.DEBIT, new BigDecimal("100.00")));
        original.addEntry(new LedgerEntry(original, receiver, EntryType.CREDIT, new BigDecimal("100.00")));
        original.complete();
    }

    @Test void createsCompensatingTransactionLinkedToOriginal() {
        when(transactions.findByIdForUpdate(original.getId())).thenReturn(Optional.of(original));
        when(transactions.existsByReversalOfId(original.getId())).thenReturn(false);
        when(locks.lock(receiver.getId(), source.getId()))
            .thenReturn(new AccountLockService.LockedAccounts(receiver, source));

        var response = service.reverse(original.getId(), "operator correction");

        ArgumentCaptor<LedgerTransaction> reversal = ArgumentCaptor.forClass(LedgerTransaction.class);
        verify(ledger).postTwoLeggedTransfer(reversal.capture(),
            org.mockito.ArgumentMatchers.eq(receiver), org.mockito.ArgumentMatchers.eq(source),
            org.mockito.ArgumentMatchers.eq(new BigDecimal("100.00")));
        assertThat(reversal.getValue().getTransactionType()).isEqualTo(TransactionType.REVERSAL);
        assertThat(response.reversalOfTransactionId()).isEqualTo(original.getId());
    }

    @Test void rejectsAnAlreadyReversedTransaction() {
        when(transactions.findByIdForUpdate(original.getId())).thenReturn(Optional.of(original));
        when(transactions.existsByReversalOfId(original.getId())).thenReturn(true);
        assertThatThrownBy(() -> service.reverse(original.getId(), "again"))
            .isInstanceOf(ApiException.class).hasMessageContaining("already");
        verify(ledger, org.mockito.Mockito.never()).postTwoLeggedTransfer(any(), any(), any(), any());
    }
}
