package com.tallyvault.ledger;

import com.tallyvault.account.Account;
import com.tallyvault.common.Money;
import com.tallyvault.transaction.LedgerTransaction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false) private LedgerTransaction transaction;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false) private Account account;
    @Enumerated(EnumType.STRING) @Column(name = "entry_type", nullable = false, length = 10)
    private EntryType entryType;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal amount;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected LedgerEntry() {}
    public LedgerEntry(LedgerTransaction transaction, Account account, EntryType entryType, BigDecimal amount) {
        this.id = UUID.randomUUID();
        this.transaction = transaction;
        this.account = account;
        this.entryType = entryType;
        this.amount = Money.requirePositive(amount);
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public LedgerTransaction getTransaction() { return transaction; }
    public Account getAccount() { return account; }
    public EntryType getEntryType() { return entryType; }
    public BigDecimal getAmount() { return amount; }
    public Instant getCreatedAt() { return createdAt; }
}

