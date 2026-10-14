package com.tallyvault.transfer;

import com.tallyvault.transaction.LedgerTransaction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "idempotency_records")
public class IdempotencyRecord {
    @Id @Column(name = "idempotency_key", length = 80) private String key;
    @Column(name = "request_hash", nullable = false, length = 64) private String requestHash;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    private LedgerTransaction transaction;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected IdempotencyRecord() {}
    public IdempotencyRecord(String key, String requestHash, LedgerTransaction transaction) {
        this.key = key;
        this.requestHash = requestHash;
        this.transaction = transaction;
        this.createdAt = Instant.now();
    }
    public String getKey() { return key; }
    public String getRequestHash() { return requestHash; }
    public LedgerTransaction getTransaction() { return transaction; }
    public Instant getCreatedAt() { return createdAt; }
}

