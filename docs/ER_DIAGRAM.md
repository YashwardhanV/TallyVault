# Entity-Relationship and Database Design

```mermaid
erDiagram
    APP_USERS ||--o{ ACCOUNTS : owns
    LEDGER_TRANSACTIONS ||--|{ LEDGER_ENTRIES : contains
    ACCOUNTS ||--o{ LEDGER_ENTRIES : records
    LEDGER_TRANSACTIONS ||--o| IDEMPOTENCY_RECORDS : claimed_by
    LEDGER_TRANSACTIONS o|--o| LEDGER_TRANSACTIONS : reverses

    APP_USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar role
        timestamptz created_at
    }
    ACCOUNTS {
        uuid id PK
        uuid owner_user_id FK
        varchar account_number UK
        varchar currency
        varchar status
        numeric cached_balance
        boolean allow_overdraft
    }
    LEDGER_TRANSACTIONS {
        uuid id PK
        varchar transaction_type
        varchar status
        varchar reference
        uuid reversal_of_transaction_id FK_UK
        timestamptz completed_at
    }
    LEDGER_ENTRIES {
        uuid id PK
        uuid transaction_id FK
        uuid account_id FK
        varchar entry_type
        numeric amount
        timestamptz created_at
    }
    IDEMPOTENCY_RECORDS {
        varchar idempotency_key PK
        varchar request_hash
        uuid transaction_id FK_UK
        timestamptz created_at
    }
```

## Tables

### `app_users`

Identity and authorization owner. Email is unique; role is checked to `USER` or `ADMIN`. Password data is only a BCrypt hash.

### `accounts`

User-owned wallet. `account_number` is a human-facing unique identifier; UUID is the internal identity. `status` is `ACTIVE`, `FROZEN`, or `CLOSED`. `cached_balance NUMERIC(19,2)` is updated in the same transaction as entries. A check constraint allows a negative balance only for an explicit system/equity account with `allow_overdraft=true`; normal accounts cannot go below zero.

### `ledger_transactions`

Header/aggregate for `TRANSFER`, `FUNDING`, or `REVERSAL`. Work begins as `PROCESSING` with no completion time; completed work must have `completed_at`. A nullable self-reference identifies the original transaction, and a unique constraint permits at most one reversal per original.

### `ledger_entries`

Append-only accounting legs. Each points to exactly one transaction and account, has `DEBIT` or `CREDIT`, and a strictly positive fixed-precision amount. Entry sign is represented by type, not negative values.

### `idempotency_records`

The caller's key is the primary key. It binds a request hash to one transaction, whose foreign key is also unique. The insert is deliberately the concurrency arbiter.

## Enforced invariants

| Invariant | Database mechanism |
|---|---|
| User email/account number/idempotency key unique | `UNIQUE` / primary-key constraints |
| Entry amount positive | `CHECK (amount > 0)` |
| Customer account balance nonnegative | conditional `CHECK` on `allow_overdraft` |
| Valid role/state/type values | `CHECK ... IN (...)` |
| Completed transaction has completion time | status/time `CHECK` |
| Every completed transaction balances | deferred constraint trigger sums debit/credit |
| Completed transaction has at least two entries | same deferred trigger |
| Entries never change or disappear | `BEFORE UPDATE OR DELETE` rejecting trigger |
| No entry appended after completion | `BEFORE INSERT` trigger |
| Completed transaction header immutable | rejecting trigger |
| Only one reversal | unique self-reference |
| References cannot point to missing rows | foreign keys |

The balance trigger is deferred until commit because a valid transaction is temporarily incomplete while its first entry exists and its second has not yet been inserted.

## Indexes and query purpose

| Index | Supports |
|---|---|
| `accounts(owner_user_id)` | user dashboard/list |
| `ledger_entries(account_id, created_at DESC)` | account history and derived balance |
| `ledger_entries(transaction_id)` | transaction detail/balance trigger |
| `ledger_transactions(created_at DESC)` | admin history pagination |
| partial reversal link index | reversal lookup |

Primary/unique constraints provide indexes for IDs, emails, account numbers, reversal uniqueness, and idempotency keys. Additional indexes should be added only after query-plan or benchmark evidence.

## Balance derivation

For a normal wallet:

$$
balance(account) = \sum credits - \sum debits
$$

For each completed transaction:

$$
\sum debits = \sum credits
$$

`GET /accounts/{id}/balance` returns both the cached and derived values plus a `consistent` flag. This is an explicit integrity check, not proof that a complete production reconciliation operation exists.

## Deletion policy

Completed financial facts have no public update/delete API, and database triggers defend that policy from direct SQL/JPA accidents. User/account retention and legal deletion requirements are intentionally unspecified; they would need a product policy (for example, pseudonymization while retaining financial records) before implementation.
