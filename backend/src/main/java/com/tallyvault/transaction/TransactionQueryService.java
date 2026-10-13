package com.tallyvault.transaction;

import com.tallyvault.account.AccountService;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.common.ApiException;
import com.tallyvault.common.PageResponse;
import com.tallyvault.transfer.TransferDtos;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransactionQueryService {
    private final LedgerTransactionRepository transactions;
    private final AccountService accountService;
    public TransactionQueryService(LedgerTransactionRepository transactions, AccountService accountService) {
        this.transactions = transactions;
        this.accountService = accountService;
    }

    @Transactional(readOnly = true)
    public TransferDtos.TransactionResponse getAuthorized(UUID id, User user) {
        LedgerTransaction tx = transactions.findDetailedById(id)
            .orElseThrow(() -> ApiException.notFound("transaction not found"));
        boolean participant = tx.getEntries().stream()
            .anyMatch(entry -> entry.getAccount().getOwner().getId().equals(user.getId()));
        if (user.getRole() != Role.ADMIN && !participant) {
            throw ApiException.forbidden("transaction is not visible to the current user");
        }
        return TransactionMapper.response(tx, false);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransferDtos.TransactionResponse> forAccount(UUID accountId, User user, int page, int size) {
        accountService.requireAuthorized(accountId, user);
        var pageable = PageRequest.of(page, bounded(size), Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.from(transactions.findByAccountId(accountId, pageable)
            .map(tx -> TransactionMapper.response(tx, false)));
    }

    @Transactional(readOnly = true)
    public PageResponse<TransferDtos.TransactionResponse> all(int page, int size) {
        var pageable = PageRequest.of(page, bounded(size));
        return PageResponse.from(transactions.findAllByOrderByCreatedAtDesc(pageable)
            .map(tx -> TransactionMapper.response(tx, false)));
    }

    private int bounded(int size) { return Math.max(1, Math.min(size, 100)); }
}
