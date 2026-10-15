package com.tallyvault.transfer;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, String> {
    @EntityGraph(attributePaths = {"transaction", "transaction.entries", "transaction.entries.account"})
    @Query("select r from IdempotencyRecord r where r.key = :key")
    Optional<IdempotencyRecord> findWithTransactionByKey(@Param("key") String key);
}

