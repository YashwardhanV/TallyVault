package com.tallyvault.transaction;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountStatus;
import com.tallyvault.common.ApiException;
import com.tallyvault.ledger.EntryType;
import com.tallyvault.ledger.LedgerEntry;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transfer.AccountLockService;
import com.tallyvault.transfer.TransferDtos;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReversalService {
    private final LedgerTransactionRepository transactions;
    private final AccountLockService locks;
    private final LedgerPostingService ledger;
    public ReversalService(LedgerTransactionRepository transactions, AccountLockService locks,
                           LedgerPostingService ledger) {
        this.transactions = transactions; this.locks = locks; this.ledger = ledger;
    }

    @Transactional
    public TransferDtos.TransactionResponse reverse(UUID originalId, String reason) {
        LedgerTransaction original = transactions.findByIdForUpdate(originalId)
            .orElseThrow(() -> ApiException.notFound("transaction not found"));
        if (original.getTransactionType() != TransactionType.TRANSFER
            || original.getStatus() != TransactionStatus.COMPLETED) {
            throw ApiException.unprocessable("not_reversible", "only completed transfers can be reversed");
        }
        if (transactions.existsByReversalOfId(originalId)) {
            throw ApiException.conflict("already_reversed", "transaction already has a reversal");
        }
        if (original.getEntries().size() != 2) {
            throw ApiException.unprocessable("not_two_legged", "only two-entry transfers can be reversed");
        }
        LedgerEntry originalDebit = original.getEntries().stream()
            .filter(e -> e.getEntryType() == EntryType.DEBIT).findFirst()
            .orElseThrow(() -> ApiException.unprocessable("invalid_ledger", "original debit entry is missing"));
        LedgerEntry originalCredit = original.getEntries().stream()
            .filter(e -> e.getEntryType() == EntryType.CREDIT).findFirst()
            .orElseThrow(() -> ApiException.unprocessable("invalid_ledger", "original credit entry is missing"));

        AccountLockService.LockedAccounts locked = locks.lock(
            originalCredit.getAccount().getId(), originalDebit.getAccount().getId());
        Account refundSource = locked.source();
        Account refundDestination = locked.destination();
        if (refundSource.getStatus() == AccountStatus.CLOSED || refundDestination.getStatus() == AccountStatus.CLOSED) {
            throw ApiException.unprocessable("closed_account", "closed accounts cannot participate in a reversal");
        }
        if (!refundSource.isAllowOverdraft()
            && refundSource.getCachedBalance().compareTo(originalCredit.getAmount()) < 0) {
            throw ApiException.unprocessable("insufficient_refund_funds", "receiver has insufficient funds for reversal");
        }

        LedgerTransaction reversal = new LedgerTransaction(TransactionType.REVERSAL, reason, original);
        transactions.save(reversal);
        ledger.postTwoLeggedTransfer(reversal, refundSource, refundDestination, originalCredit.getAmount());
        reversal.complete();
        transactions.saveAndFlush(reversal);
        return TransactionMapper.response(reversal, false);
    }
}

