package com.tallyvault.account;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    Optional<Account> findByAccountNumber(String accountNumber);
    List<Account> findByOwnerIdOrderByCreatedAtAsc(UUID ownerId);
    Page<Account> findByOwnerId(UUID ownerId, Pageable pageable);
    Optional<Account> findFirstByOwnerIdAndAllowOverdraftTrue(UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a join fetch a.owner where a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") UUID id);
}
