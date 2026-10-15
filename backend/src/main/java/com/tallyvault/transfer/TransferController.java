package com.tallyvault.transfer;

import com.tallyvault.auth.CurrentUser;
import com.tallyvault.transaction.TransactionQueryService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/transfers")
public class TransferController {
    private final TransferService transfers;
    private final TransactionQueryService queries;
    private final CurrentUser currentUser;
    public TransferController(TransferService transfers, TransactionQueryService queries, CurrentUser currentUser) {
        this.transfers = transfers; this.queries = queries; this.currentUser = currentUser;
    }

    @PostMapping
    ResponseEntity<TransferDtos.TransactionResponse> transfer(
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody TransferDtos.TransferRequest request) {
        var result = transfers.transfer(key, request, currentUser.require());
        return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(result);
    }

    @GetMapping("/{id}")
    TransferDtos.TransactionResponse get(@PathVariable UUID id) {
        return queries.getAuthorized(id, currentUser.require());
    }
}

