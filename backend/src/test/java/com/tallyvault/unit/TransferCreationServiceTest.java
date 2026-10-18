package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountRepository;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.common.ApiException;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransactionRepository;
import com.tallyvault.transfer.AccountLockService;
import com.tallyvault.transfer.IdempotencyRecordRepository;
import com.tallyvault.transfer.TransferCreationService;
import com.tallyvault.transfer.TransferDtos;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TransferCreationServiceTest {
    @Mock AccountRepository accounts;
    @Mock LedgerTransactionRepository transactions;
    @Mock IdempotencyRecordRepository idempotency;
    @Mock AccountLockService locks;
    @Mock LedgerPostingService ledger;
    TransferCreationService service;
    User actor;

    @BeforeEach void setUp() {
        service = new TransferCreationService(accounts, transactions, idempotency, locks, ledger);
        actor = new User("actor@example.com", "hash", "Actor", Role.USER);
    }

    @Test void rejectsSameSourceAndDestinationBeforeWriting() {
        UUID id = UUID.randomUUID();
        var request = new TransferDtos.TransferRequest(id, id, new BigDecimal("10.00"), "same");
        assertThatThrownBy(() -> service.create("key", "hash", request, actor))
            .isInstanceOf(ApiException.class).hasMessageContaining("must differ");
        verify(transactions, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test void rejectsInsufficientFundsAfterAccountsAreLocked() {
        Account source = new Account(actor, "SOURCE", "Source", "INR", false);
        Account destination = new Account(actor, "DEST", "Destination", "INR", false);
        var request = new TransferDtos.TransferRequest(source.getId(), destination.getId(),
            new BigDecimal("10.00"), "too much");
        when(accounts.findById(source.getId())).thenReturn(Optional.of(source));
        when(locks.lock(source.getId(), destination.getId()))
            .thenReturn(new AccountLockService.LockedAccounts(source, destination));

        assertThatThrownBy(() -> service.create("key", "hash", request, actor))
            .isInstanceOf(ApiException.class).hasMessageContaining("insufficient");
        verify(locks).lock(source.getId(), destination.getId());
        verify(ledger, never()).postTwoLeggedTransfer(
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test void rejectsFrozenSourceAfterAccountsAreLocked() {
        Account source = new Account(actor, "SOURCE", "Source", "INR", false);
        Account destination = new Account(actor, "DEST", "Destination", "INR", false);
        source.credit(new BigDecimal("100.00"));
        source.freeze();
        var request = new TransferDtos.TransferRequest(source.getId(), destination.getId(),
            new BigDecimal("10.00"), "frozen");
        when(accounts.findById(source.getId())).thenReturn(Optional.of(source));
        when(locks.lock(source.getId(), destination.getId()))
            .thenReturn(new AccountLockService.LockedAccounts(source, destination));

        assertThatThrownBy(() -> service.create("key", "hash", request, actor))
            .isInstanceOf(ApiException.class).hasMessageContaining("active");
        verify(ledger, never()).postTwoLeggedTransfer(
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
