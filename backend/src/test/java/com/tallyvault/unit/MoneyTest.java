package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tallyvault.common.Money;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MoneyTest {
    @Test void normalizesTwoDecimalMoney() {
        assertThat(Money.requirePositive(new BigDecimal("10.5"))).isEqualByComparingTo("10.50");
    }

    @Test void rejectsFloatingPointLikeExtraPrecision() {
        assertThatThrownBy(() -> Money.requirePositive(new BigDecimal("10.001")))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("2 decimal");
    }

    @Test void rejectsZeroAndNegativeAmounts() {
        assertThatThrownBy(() -> Money.requirePositive(BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.requirePositive(new BigDecimal("-1.00"))).isInstanceOf(IllegalArgumentException.class);
    }
}

