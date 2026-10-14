package com.tallyvault.transfer;

import com.tallyvault.transaction.LedgerTransaction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "idempotency_records")
/**
 * Implements {@link Persistable} so Spring Data always INSERTs a new record. With an assigned String id,
 * the default isNew() check returns false and save() falls back to merge(), which silently UPDATEs an
 * existing key instead of failing on the primary key and triggering the replay path.
 */
public class IdempotencyRecord implements Persistable<String> {
    @Id @Column(name = "idempotency_key", length = 80) private String key;
    @Column(name = "request_hash", nullable = false, length = 64) private String requestHash;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    private LedgerTransaction transaction;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    @Transient private boolean isNew = true;

    protected IdempotencyRecord() {}
    public IdempotencyRecord(String key, String requestHash, LedgerTransaction transaction) {
        this.key = key;
        this.requestHash = requestHash;
        this.transaction = transaction;
        this.createdAt = Instant.now();
    }
    @Override public String getId() { return key; }
    @Override public boolean isNew() { return isNew; }
    @PostLoad @PostPersist void markNotNew() { this.isNew = false; }
    public String getKey() { return key; }
    public String getRequestHash() { return requestHash; }
    public LedgerTransaction getTransaction() { return transaction; }
    public Instant getCreatedAt() { return createdAt; }
}

