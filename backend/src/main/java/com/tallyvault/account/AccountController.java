package com.tallyvault.account;

import com.tallyvault.auth.CurrentUser;
import com.tallyvault.common.PageResponse;
import com.tallyvault.transaction.TransactionQueryService;
import com.tallyvault.transfer.TransferDtos;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/accounts")
public class AccountController {
    private final AccountService accounts;
    private final TransactionQueryService transactions;
    private final CurrentUser currentUser;
    public AccountController(AccountService accounts, TransactionQueryService transactions, CurrentUser currentUser) {
        this.accounts = accounts; this.transactions = transactions; this.currentUser = currentUser;
    }

    @PostMapping
    ResponseEntity<AccountDtos.AccountResponse> create(@Valid @RequestBody AccountDtos.CreateAccountRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(accounts.create(request, currentUser.require()));
    }
    @GetMapping
    List<AccountDtos.AccountResponse> own() { return accounts.own(currentUser.require()); }
    @GetMapping("/lookup")
    AccountDtos.AccountLookupResponse lookup(@RequestParam String accountNumber) {
        currentUser.require();
        return accounts.lookup(accountNumber);
    }
    @GetMapping("/{id}")
    AccountDtos.AccountResponse get(@PathVariable UUID id) { return accounts.getAuthorized(id, currentUser.require()); }
    @GetMapping("/{id}/balance")
    AccountDtos.BalanceResponse balance(@PathVariable UUID id) { return accounts.balance(id, currentUser.require()); }
    @GetMapping("/{id}/transactions")
    PageResponse<TransferDtos.TransactionResponse> history(@PathVariable UUID id,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return transactions.forAccount(id, currentUser.require(), page, size);
    }
}
