package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.tallyvault.account.Account;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.ledger.EntryType;
import com.tallyvault.ledger.LedgerEntry;
import com.tallyvault.ledger.LedgerEntryRepository;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransaction;
import com.tallyvault.transaction.TransactionType;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LedgerPostingServiceTest {
    @Mock LedgerEntryRepository entries;

    @Test void postsEqualDebitAndCreditAndUpdatesBalanceCache() {
        User owner = new User("owner@example.com", "hash", "Owner", Role.USER);
        Account source = new Account(owner, "A", "Source", "INR", false);
        Account destination = new Account(owner, "B", "Destination", "INR", false);
        source.credit(new BigDecimal("1000.00"));
        LedgerTransaction tx = new LedgerTransaction(TransactionType.TRANSFER, "test", null);

        new LedgerPostingService(entries).postTwoLeggedTransfer(tx, source, destination, new BigDecimal("250.00"));

        ArgumentCaptor<LedgerEntry> captor = ArgumentCaptor.forClass(LedgerEntry.class);
        verify(entries, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(LedgerEntry::getEntryType)
            .containsExactly(EntryType.DEBIT, EntryType.CREDIT);
        assertThat(captor.getAllValues()).extracting(LedgerEntry::getAmount)
            .allMatch(amount -> amount.compareTo(new BigDecimal("250.00")) == 0);
        assertThat(source.getCachedBalance()).isEqualByComparingTo("750.00");
        assertThat(destination.getCachedBalance()).isEqualByComparingTo("250.00");
    }
}
