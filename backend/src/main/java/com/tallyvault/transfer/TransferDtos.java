package com.tallyvault.transfer;

import com.tallyvault.ledger.EntryType;
import com.tallyvault.transaction.TransactionStatus;
import com.tallyvault.transaction.TransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class TransferDtos {
    private TransferDtos() {}
    public record TransferRequest(
        @NotNull UUID sourceAccountId,
        @NotNull UUID destinationAccountId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount,
        @Size(max = 140) String reference) {}
    public record EntryResponse(UUID entryId, UUID accountId, String accountNumber,
                                EntryType entryType, BigDecimal amount, Instant createdAt) {}
    public record TransactionResponse(UUID transactionId, TransactionType transactionType,
        TransactionStatus status, String reference, UUID reversalOfTransactionId,
        Instant createdAt, Instant completedAt, boolean replayed, List<EntryResponse> entries) {}
    public record ReversalRequest(@NotNull @Size(min = 3, max = 140) String reason) {}
}

