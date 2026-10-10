package com.tallyvault.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class Money {
    public static final int SCALE = 2;
    public static final BigDecimal ZERO = new BigDecimal("0.00");
    private Money() {}

    public static BigDecimal normalize(BigDecimal value) {
        if (value == null) throw new IllegalArgumentException("amount is required");
        try {
            return value.setScale(SCALE, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException ex) {
            throw new IllegalArgumentException("amount must have at most 2 decimal places");
        }
    }

    public static BigDecimal requirePositive(BigDecimal value) {
        BigDecimal normalized = normalize(value);
        if (normalized.signum() <= 0) throw new IllegalArgumentException("amount must be greater than zero");
        if (normalized.precision() > 19) throw new IllegalArgumentException("amount is too large");
        return normalized;
    }
}

