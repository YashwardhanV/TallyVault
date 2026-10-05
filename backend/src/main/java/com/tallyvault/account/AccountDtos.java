package com.tallyvault.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class AccountDtos {
    private AccountDtos() {}
    public record CreateAccountRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency) {}
    public record AccountResponse(UUID id, String accountNumber, String name, String currency,
        AccountStatus status, BigDecimal balance, Instant createdAt) {}
    public record BalanceResponse(UUID accountId, String currency, BigDecimal cachedBalance,
        BigDecimal ledgerBalance, boolean reconciled) {}
    public record AccountLookupResponse(UUID id, String accountNumber, String name,
        String currency, AccountStatus status) {}
    public record StatusRequest(@NotNull AccountStatus status) {}
}
