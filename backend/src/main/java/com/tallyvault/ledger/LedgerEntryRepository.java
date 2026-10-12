package com.tallyvault.ledger;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {
    @Query("""
        select coalesce(sum(case when e.entryType = com.tallyvault.ledger.EntryType.CREDIT
                                 then e.amount else -e.amount end), 0)
          from LedgerEntry e where e.account.id = :accountId
        """)
    BigDecimal calculateBalance(@Param("accountId") UUID accountId);
    long countByTransactionId(UUID transactionId);
}
