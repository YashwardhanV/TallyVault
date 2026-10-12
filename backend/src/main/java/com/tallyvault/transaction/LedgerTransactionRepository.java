package com.tallyvault.transaction;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerTransactionRepository extends JpaRepository<LedgerTransaction, UUID> {
    boolean existsByReversalOfId(UUID originalId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from LedgerTransaction t where t.id = :id")
    Optional<LedgerTransaction> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"entries", "entries.account", "reversalOf"})
    @Query("select t from LedgerTransaction t where t.id = :id")
    Optional<LedgerTransaction> findDetailedById(@Param("id") UUID id);

    @Query(value = "select distinct t from LedgerTransaction t join t.entries e where e.account.id = :accountId",
           countQuery = "select count(distinct t.id) from LedgerTransaction t join t.entries e where e.account.id = :accountId")
    Page<LedgerTransaction> findByAccountId(@Param("accountId") UUID accountId, Pageable pageable);

    Page<LedgerTransaction> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

