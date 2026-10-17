package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tallyvault.account.Account;
import com.tallyvault.account.AccountStatus;
import com.tallyvault.auth.Role;
import com.tallyvault.auth.User;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class AccountTest {
    private final User owner = new User("owner@example.com", "hash", "Owner", Role.USER);

    @Test void customerAccountCannotBecomeNegative() {
        Account account = new Account(owner, "A", "Wallet", "INR", false);
        account.credit(new BigDecimal("100.00"));
        assertThatThrownBy(() -> account.debit(new BigDecimal("100.01")))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("negative");
        assertThat(account.getCachedBalance()).isEqualByComparingTo("100.00");
    }

    @Test void activeAccountCanBeFrozenAndReactivated() {
        Account account = new Account(owner, "A", "Wallet", "INR", false);
        account.freeze();
        assertThat(account.getStatus()).isEqualTo(AccountStatus.FROZEN);
        account.activate();
        assertThat(account.getStatus()).isEqualTo(AccountStatus.ACTIVE);
    }
}
