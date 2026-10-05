package com.tallyvault.account;

import com.tallyvault.auth.User;
import com.tallyvault.common.Money;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "accounts")
public class Account {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(name = "account_number", nullable = false, unique = true, length = 24)
    private String accountNumber;
    @Column(nullable = false, length = 100) private String name;
    @Column(nullable = false, length = 3) private String currency;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private AccountStatus status;
    @Column(name = "cached_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal cachedBalance;
    @Column(name = "allow_overdraft", nullable = false) private boolean allowOverdraft;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Account() {}

    public Account(User owner, String accountNumber, String name, String currency, boolean allowOverdraft) {
        this.id = UUID.randomUUID();
        this.owner = owner;
        this.accountNumber = accountNumber;
        this.name = name.strip();
        this.currency = currency.toUpperCase();
        this.status = AccountStatus.ACTIVE;
        this.cachedBalance = Money.ZERO;
        this.allowOverdraft = allowOverdraft;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public void debit(BigDecimal amount) {
        BigDecimal next = Money.normalize(cachedBalance.subtract(amount));
        if (!allowOverdraft && next.signum() < 0) throw new IllegalStateException("account balance cannot become negative");
        cachedBalance = next;
        updatedAt = Instant.now();
    }

    public void credit(BigDecimal amount) {
        cachedBalance = Money.normalize(cachedBalance.add(amount));
        updatedAt = Instant.now();
    }

    public void freeze() {
        if (status == AccountStatus.CLOSED) throw new IllegalStateException("closed account cannot be frozen");
        status = AccountStatus.FROZEN;
        updatedAt = Instant.now();
    }

    public void activate() {
        if (status == AccountStatus.CLOSED) throw new IllegalStateException("closed account cannot be reopened");
        status = AccountStatus.ACTIVE;
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public User getOwner() { return owner; }
    public String getAccountNumber() { return accountNumber; }
    public String getName() { return name; }
    public String getCurrency() { return currency; }
    public AccountStatus getStatus() { return status; }
    public BigDecimal getCachedBalance() { return cachedBalance; }
    public boolean isAllowOverdraft() { return allowOverdraft; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

