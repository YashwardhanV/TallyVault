package com.tallyvault.transaction;

import com.tallyvault.ledger.LedgerEntry;
import com.tallyvault.transfer.TransferDtos;
import java.util.Comparator;

public final class TransactionMapper {
    private TransactionMapper() {}
    public static TransferDtos.TransactionResponse response(LedgerTransaction transaction, boolean replayed) {
        var entries = transaction.getEntries().stream()
            .sorted(Comparator.comparing(LedgerEntry::getCreatedAt).thenComparing(LedgerEntry::getId))
            .map(entry -> new TransferDtos.EntryResponse(entry.getId(), entry.getAccount().getId(),
                entry.getAccount().getAccountNumber(), entry.getEntryType(), entry.getAmount(), entry.getCreatedAt()))
            .toList();
        return new TransferDtos.TransactionResponse(transaction.getId(), transaction.getTransactionType(),
            transaction.getStatus(), transaction.getReference(),
            transaction.getReversalOf() == null ? null : transaction.getReversalOf().getId(),
            transaction.getCreatedAt(), transaction.getCompletedAt(), replayed, entries);
    }
}
