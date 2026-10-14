package com.tallyvault.transfer;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountRepository;
import com.tallyvault.common.ApiException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AccountLockService {
    private final AccountRepository accounts;
    public AccountLockService(AccountRepository accounts) { this.accounts = accounts; }

    public LockedAccounts lock(UUID sourceId, UUID destinationId) {
        List<UUID> ids = List.of(sourceId, destinationId).stream()
            .sorted(Comparator.comparing(UUID::toString)).toList();
        Account first = accounts.findByIdForUpdate(ids.get(0))
            .orElseThrow(() -> ApiException.notFound("account " + ids.get(0) + " not found"));
        Account second = accounts.findByIdForUpdate(ids.get(1))
            .orElseThrow(() -> ApiException.notFound("account " + ids.get(1) + " not found"));
        return first.getId().equals(sourceId) ? new LockedAccounts(first, second) : new LockedAccounts(second, first);
    }

    public record LockedAccounts(Account source, Account destination) {}
}

