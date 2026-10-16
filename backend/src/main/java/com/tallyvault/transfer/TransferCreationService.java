package com.tallyvault.transfer;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountRepository;
import com.tallyvault.account.AccountStatus;
import com.tallyvault.auth.User;
import com.tallyvault.common.ApiException;
import com.tallyvault.common.Money;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransaction;
import com.tallyvault.transaction.LedgerTransactionRepository;
import com.tallyvault.transaction.TransactionMapper;
import com.tallyvault.transaction.TransactionType;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransferCreationService {
    private final AccountRepository accounts;
    private final LedgerTransactionRepository transactions;
    private final IdempotencyRecordRepository idempotency;
    private final AccountLockService locks;
    private final LedgerPostingService ledger;

    public TransferCreationService(AccountRepository accounts, LedgerTransactionRepository transactions,
                                   IdempotencyRecordRepository idempotency, AccountLockService locks,
                                   LedgerPostingService ledger) {
        this.accounts = accounts;
        this.transactions = transactions;
        this.idempotency = idempotency;
        this.locks = locks;
        this.ledger = ledger;
    }

    @Transactional
    public TransferDtos.TransactionResponse create(
        String key, String requestHash, TransferDtos.TransferRequest request, User actor) {
        BigDecimal amount = Money.requirePositive(request.amount());
        if (request.sourceAccountId().equals(request.destinationAccountId())) {
            throw ApiException.unprocessable("same_account", "source and destination accounts must differ");
        }
        // Lock before any other read of these accounts. Loading an account first (e.g. findById) puts it in
        // the persistence context, and the later SELECT ... FOR UPDATE then returns that stale cached
        // instance, so two transfers would both see the old balance (overspend / lost updates).
        AccountLockService.LockedAccounts locked = locks.lock(request.sourceAccountId(), request.destinationAccountId());
        if (!locked.source().getOwner().getId().equals(actor.getId())) {
            throw ApiException.forbidden("you can transfer only from your own account");
        }

        LedgerTransaction transaction = new LedgerTransaction(TransactionType.TRANSFER, request.reference(), null);
        transaction = transactions.save(transaction);
        // Claim by INSERT, never check-then-insert. The database primary key resolves concurrent retries.
        idempotency.saveAndFlush(new IdempotencyRecord(key, requestHash, transaction));

        validateAccounts(locked.source(), locked.destination(), actor, amount);
        ledger.postTwoLeggedTransfer(transaction, locked.source(), locked.destination(), amount);
        transaction.complete();
        transactions.saveAndFlush(transaction);
        return TransactionMapper.response(transaction, false);
    }

    private void validateAccounts(Account source, Account destination, User actor, BigDecimal amount) {
        if (!source.getOwner().getId().equals(actor.getId())) {
            throw ApiException.forbidden("you can transfer only from your own account");
        }
        if (source.getStatus() != AccountStatus.ACTIVE || destination.getStatus() != AccountStatus.ACTIVE) {
            throw ApiException.unprocessable("account_not_active", "both accounts must be active");
        }
        if (!source.getCurrency().equals(destination.getCurrency())) {
            throw ApiException.unprocessable("currency_mismatch", "accounts must use the same currency");
        }
        if (!source.isAllowOverdraft() && source.getCachedBalance().compareTo(amount) < 0) {
            throw ApiException.unprocessable("insufficient_funds", "source account has insufficient funds");
        }
    }
}
