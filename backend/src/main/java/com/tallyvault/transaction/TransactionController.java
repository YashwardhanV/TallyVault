package com.tallyvault.transaction;

import com.tallyvault.auth.CurrentUser;
import com.tallyvault.common.PageResponse;
import com.tallyvault.transfer.TransferDtos;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/transactions")
public class TransactionController {
    private final TransactionQueryService queries;
    private final ReversalService reversals;
    private final CurrentUser currentUser;
    public TransactionController(TransactionQueryService queries, ReversalService reversals, CurrentUser currentUser) {
        this.queries = queries; this.reversals = reversals; this.currentUser = currentUser;
    }

    @GetMapping("/{id}")
    TransferDtos.TransactionResponse get(@PathVariable UUID id) {
        return queries.getAuthorized(id, currentUser.require());
    }

    @PostMapping("/{id}/reverse")
    @PreAuthorize("hasRole('ADMIN')")
    TransferDtos.TransactionResponse reverse(@PathVariable UUID id,
        @Valid @RequestBody TransferDtos.ReversalRequest request) {
        currentUser.require();
        return reversals.reverse(id, request.reason());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    PageResponse<TransferDtos.TransactionResponse> all(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        return queries.all(page, size);
    }
}

