package com.tallyvault.account;

import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.common.ApiException;
import com.tallyvault.common.Money;
import com.tallyvault.ledger.LedgerEntryRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {
    private final AccountRepository accounts;
    private final LedgerEntryRepository entries;
    public AccountService(AccountRepository accounts, LedgerEntryRepository entries) {
        this.accounts = accounts;
        this.entries = entries;
    }

    @Transactional
    public AccountDtos.AccountResponse create(AccountDtos.CreateAccountRequest request, User owner) {
        Account account = new Account(owner, newAccountNumber(), request.name(), request.currency(), false);
        return response(accounts.save(account));
    }

    @Transactional(readOnly = true)
    public List<AccountDtos.AccountResponse> own(User user) {
        return accounts.findByOwnerIdOrderByCreatedAtAsc(user.getId()).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public AccountDtos.AccountResponse getAuthorized(UUID id, User user) {
        return response(requireAuthorized(id, user));
    }

    @Transactional(readOnly = true)
    public AccountDtos.AccountLookupResponse lookup(String accountNumber) {
        Account account = accounts.findByAccountNumber(accountNumber.strip().toUpperCase())
            .orElseThrow(() -> ApiException.notFound("destination account not found"));
        return new AccountDtos.AccountLookupResponse(account.getId(), account.getAccountNumber(),
            account.getName(), account.getCurrency(), account.getStatus());
    }

    @Transactional(readOnly = true)
    public AccountDtos.BalanceResponse balance(UUID id, User user) {
        Account account = requireAuthorized(id, user);
        BigDecimal derived = Money.normalize(entries.calculateBalance(id));
        return new AccountDtos.BalanceResponse(id, account.getCurrency(), account.getCachedBalance(), derived,
            account.getCachedBalance().compareTo(derived) == 0);
    }

    @Transactional(readOnly = true)
    public Page<AccountDtos.AccountResponse> all(Pageable pageable) {
        return accounts.findAll(pageable).map(this::response);
    }

    @Transactional
    public AccountDtos.AccountResponse changeStatus(UUID id, AccountStatus status) {
        if (status == null || status == AccountStatus.CLOSED) {
            throw new IllegalArgumentException("admin status change supports ACTIVE or FROZEN");
        }
        Account account = accounts.findByIdForUpdate(id)
            .orElseThrow(() -> ApiException.notFound("account not found"));
        if (status == AccountStatus.ACTIVE) account.activate(); else account.freeze();
        return response(account);
    }

    @Transactional(readOnly = true)
    public Account requireAuthorized(UUID id, User user) {
        Account account = accounts.findById(id).orElseThrow(() -> ApiException.notFound("account not found"));
        if (user.getRole() != Role.ADMIN && !account.getOwner().getId().equals(user.getId())) {
            throw ApiException.forbidden("account does not belong to the current user");
        }
        return account;
    }

    private String newAccountNumber() {
        return "TV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
    }

    private AccountDtos.AccountResponse response(Account account) {
        return new AccountDtos.AccountResponse(account.getId(), account.getAccountNumber(), account.getName(),
            account.getCurrency(), account.getStatus(), account.getCachedBalance(), account.getCreatedAt());
    }
}
