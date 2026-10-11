package com.tallyvault.config;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountRepository;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import com.tallyvault.auth.UserRepository;
import com.tallyvault.ledger.LedgerPostingService;
import com.tallyvault.transaction.LedgerTransaction;
import com.tallyvault.transaction.LedgerTransactionRepository;
import com.tallyvault.transaction.TransactionType;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DemoDataService {
    private final UserRepository users;
    private final AccountRepository accounts;
    private final LedgerTransactionRepository transactions;
    private final LedgerPostingService ledger;
    private final PasswordEncoder passwords;

    public DemoDataService(UserRepository users, AccountRepository accounts,
                           LedgerTransactionRepository transactions, LedgerPostingService ledger,
                           PasswordEncoder passwords) {
        this.users = users; this.accounts = accounts; this.transactions = transactions;
        this.ledger = ledger; this.passwords = passwords;
    }

    @Transactional
    public void seedIfEmpty() {
        if (users.count() > 0) return;
        User system = users.save(new User("system@tallyvault.internal",
            passwords.encode(UUID.randomUUID().toString()), "TallyVault System", Role.ADMIN));
        users.save(new User("admin@tallyvault.dev", passwords.encode("Admin123!"),
            "TallyVault Admin", Role.ADMIN));
        User alice = users.save(new User("alice@tallyvault.dev", passwords.encode("Alice123!"),
            "Alice Sharma", Role.USER));
        User bob = users.save(new User("bob@tallyvault.dev", passwords.encode("Bob12345!"),
            "Bob Mehta", Role.USER));

        Account equity = accounts.save(new Account(system, "TV-SYSTEM-EQUITY", "System equity", "INR", true));
        Account aliceWallet = accounts.save(new Account(alice, "TV-ALICE-001", "Primary wallet", "INR", false));
        Account bobWallet = accounts.save(new Account(bob, "TV-BOB-001", "Primary wallet", "INR", false));
        accounts.flush();

        fund(equity, aliceWallet, new BigDecimal("250000.00"), "Demo opening balance — Alice");
        fund(equity, bobWallet, new BigDecimal("175000.00"), "Demo opening balance — Bob");
    }

    private void fund(Account equity, Account destination, BigDecimal amount, String reference) {
        LedgerTransaction transaction = new LedgerTransaction(TransactionType.FUNDING, reference, null);
        transactions.save(transaction);
        ledger.postTwoLeggedTransfer(transaction, equity, destination, amount);
        transaction.complete();
        transactions.save(transaction);
    }
}
