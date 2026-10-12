package com.tallyvault.transaction;

import com.tallyvault.ledger.LedgerEntry;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ledger_transactions")
public class LedgerTransaction {
    @Id private UUID id;
    @Enumerated(EnumType.STRING) @Column(name = "transaction_type", nullable = false, length = 20)
    private TransactionType transactionType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private TransactionStatus status;
    @Column(length = 140) private String reference;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reversal_of_transaction_id", unique = true)
    private LedgerTransaction reversalOf;
    @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL, orphanRemoval = false)
    private List<LedgerEntry> entries = new ArrayList<>();
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "completed_at") private Instant completedAt;

    protected LedgerTransaction() {}

    public LedgerTransaction(TransactionType type, String reference, LedgerTransaction reversalOf) {
        this.id = UUID.randomUUID();
        this.transactionType = type;
        this.status = TransactionStatus.PROCESSING;
        this.reference = reference == null || reference.isBlank() ? null : reference.strip();
        this.reversalOf = reversalOf;
        this.createdAt = Instant.now();
    }

    public void addEntry(LedgerEntry entry) { entries.add(entry); }
    public void complete() {
        if (status != TransactionStatus.PROCESSING) throw new IllegalStateException("transaction is not processing");
        status = TransactionStatus.COMPLETED;
        completedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public TransactionType getTransactionType() { return transactionType; }
    public TransactionStatus getStatus() { return status; }
    public String getReference() { return reference; }
    public LedgerTransaction getReversalOf() { return reversalOf; }
    public List<LedgerEntry> getEntries() { return Collections.unmodifiableList(entries); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getCompletedAt() { return completedAt; }
}

