package com.tallyvault.account;

import com.tallyvault.common.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/accounts")
public class AdminAccountController {
    private final AccountService accounts;
    public AdminAccountController(AccountService accounts) { this.accounts = accounts; }

    @GetMapping
    PageResponse<AccountDtos.AccountResponse> all(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        var pageable = PageRequest.of(page, Math.max(1, Math.min(size, 100)),
            Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.from(accounts.all(pageable));
    }

    @PatchMapping("/{id}/status")
    AccountDtos.AccountResponse status(@PathVariable UUID id,
        @Valid @RequestBody AccountDtos.StatusRequest request) {
        return accounts.changeStatus(id, request.status());
    }
}
