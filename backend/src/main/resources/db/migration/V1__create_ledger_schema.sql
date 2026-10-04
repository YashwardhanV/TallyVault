CREATE TABLE app_users (
    id            UUID PRIMARY KEY,
    email         VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY,
    owner_user_id   UUID         NOT NULL REFERENCES app_users(id),
    account_number  VARCHAR(24)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    currency        VARCHAR(3)   NOT NULL,
    status          VARCHAR(20)  NOT NULL CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    cached_balance  NUMERIC(19,2) NOT NULL DEFAULT 0,
    allow_overdraft BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT account_balance_valid CHECK (allow_overdraft OR cached_balance >= 0)
);

CREATE INDEX idx_accounts_owner ON accounts(owner_user_id);

CREATE TABLE ledger_transactions (
    id                       UUID PRIMARY KEY,
    transaction_type         VARCHAR(20)  NOT NULL CHECK (transaction_type IN ('TRANSFER', 'FUNDING', 'REVERSAL')),
    status                   VARCHAR(20)  NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED')),
    reference                VARCHAR(140),
    reversal_of_transaction_id UUID REFERENCES ledger_transactions(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at             TIMESTAMPTZ,
    CONSTRAINT uq_single_reversal UNIQUE (reversal_of_transaction_id),
    CONSTRAINT completed_has_time CHECK (
        (status = 'PROCESSING' AND completed_at IS NULL)
        OR (status = 'COMPLETED' AND completed_at IS NOT NULL)
    )
);

CREATE INDEX idx_transactions_created ON ledger_transactions(created_at DESC);
CREATE INDEX idx_transactions_reversal_of ON ledger_transactions(reversal_of_transaction_id)
    WHERE reversal_of_transaction_id IS NOT NULL;

CREATE TABLE ledger_entries (
    id             UUID PRIMARY KEY,
    transaction_id UUID          NOT NULL REFERENCES ledger_transactions(id),
    account_id     UUID          NOT NULL REFERENCES accounts(id),
    entry_type     VARCHAR(10)   NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount         NUMERIC(19,2) NOT NULL CHECK (amount > 0),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_entries_account_created ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_entries_transaction ON ledger_entries(transaction_id);

CREATE TABLE idempotency_records (
    idempotency_key VARCHAR(80) PRIMARY KEY,
    request_hash    VARCHAR(64) NOT NULL,
    transaction_id UUID        NOT NULL UNIQUE REFERENCES ledger_transactions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION assert_completed_transaction_balances() RETURNS TRIGGER AS $$
DECLARE
    debit_total  NUMERIC(19,2);
    credit_total NUMERIC(19,2);
    entry_count  INTEGER;
BEGIN
    IF (SELECT status FROM ledger_transactions WHERE id = NEW.id) = 'COMPLETED' THEN
        SELECT COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0),
               COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0),
               COUNT(*)
          INTO debit_total, credit_total, entry_count
          FROM ledger_entries
         WHERE transaction_id = NEW.id;

        IF entry_count < 2 OR debit_total <> credit_total THEN
            RAISE EXCEPTION 'completed transaction % is unbalanced: debits %, credits %, entries %',
                NEW.id, debit_total, credit_total, entry_count
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER completed_transactions_must_balance
    AFTER INSERT OR UPDATE ON ledger_transactions
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_completed_transaction_balances();

CREATE FUNCTION reject_ledger_entry_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger entries are append-only: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_entry_mutation();

CREATE FUNCTION reject_entry_on_completed_transaction() RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT status FROM ledger_transactions WHERE id = NEW.transaction_id) = 'COMPLETED' THEN
        RAISE EXCEPTION 'cannot append to completed transaction %', NEW.transaction_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_entries_after_transaction_completion
    BEFORE INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_entry_on_completed_transaction();

CREATE FUNCTION reject_completed_transaction_mutation() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'completed ledger transactions are immutable: % is not allowed', TG_OP
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER completed_transactions_immutable
    BEFORE UPDATE OR DELETE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION reject_completed_transaction_mutation();
