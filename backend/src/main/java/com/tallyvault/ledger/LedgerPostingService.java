package com.tallyvault.ledger;

import com.tallyvault.account.Account;
import com.tallyvault.common.Money;
import com.tallyvault.transaction.LedgerTransaction;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;

@Service
public class LedgerPostingService {
    private final LedgerEntryRepository entries;
    public LedgerPostingService(LedgerEntryRepository entries) { this.entries = entries; }

    public void postTwoLeggedTransfer(
        LedgerTransaction transaction, Account debitAccount, Account creditAccount, BigDecimal rawAmount) {
        BigDecimal amount = Money.requirePositive(rawAmount);
        LedgerEntry debit = new LedgerEntry(transaction, debitAccount, EntryType.DEBIT, amount);
        LedgerEntry credit = new LedgerEntry(transaction, creditAccount, EntryType.CREDIT, amount);
        debitAccount.debit(amount);
        creditAccount.credit(amount);
        transaction.addEntry(debit);
        transaction.addEntry(credit);
        entries.save(debit);
        entries.save(credit);
    }
}

