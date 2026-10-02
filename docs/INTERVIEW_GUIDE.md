# TallyVault Interview Guide

Use this to understand and defend the project, not to memorize impressive phrases. In an interview, draw one transfer and explain where each invariant is enforced.

## Core mental model

### What double-entry accounting means

A money movement is not represented only by changing two balance fields. It is a transaction header plus entries. Alice paying Bob ₹500 creates a ₹500 debit against Alice and a ₹500 credit to Bob. The economic amount is recorded twice from two account perspectives, so the transaction can prove where value came from and where it went.

For every completed transaction:

$$
\sum debit\ amounts = \sum credit\ amounts
$$

If they differ, value was created or destroyed inside the ledger. Equality does not prove the business intent was correct—it could still debit the wrong account—but it proves the accounting transaction is internally balanced.

### Why `BigDecimal`

Binary floating point cannot exactly represent many decimal fractions. For example, repeated `0.1` arithmetic can accumulate representation error. `BigDecimal` represents decimal values and makes scale/rounding choices visible. TallyVault requires scale 2 with no implicit rounding. PostgreSQL uses `NUMERIC(19,2)` for the same reason.

Do not say “`BigDecimal` solves every money problem.” Currency minor units, maximum amounts, rounding allocation, FX, and serialization still need explicit policy.

### Transaction boundary

`TransferCreationService.create` has the local database transaction. Inside it TallyVault creates the header/idempotency record, locks and validates accounts, appends entries, updates cached balances, and completes the header. A runtime exception rolls the work back. Nothing financial is committed until the method's transaction commits.

### ACID in this project

- **Atomicity:** debit, credit, cached balances, idempotency claim, and completion all commit or all roll back.
- **Consistency:** check/unique/foreign-key constraints and deferred triggers move the database only between valid states.
- **Isolation:** row locks serialize conflicting account changes, so the funds decision does not use a stale balance.
- **Durability:** after PostgreSQL acknowledges commit, the ledger rows survive process restart according to PostgreSQL's durability configuration.

ACID does not mean all concurrent operations run one at a time. Nonconflicting account pairs can proceed independently.

### Isolation levels and locks

The configured baseline is PostgreSQL `READ COMMITTED`. Each statement normally sees committed data as of that statement. Plain reads alone would allow both ₹800 requests to observe ₹1,000. `SELECT ... FOR UPDATE` changes the important path: it locks the account row, and a waiter reads the row after the holder commits. The business invariant comes from targeted locking plus transactional work, not from claiming that `READ COMMITTED` prevents every anomaly.

### Pessimistic vs optimistic locking

| Strategy | Behavior | Strength | Cost |
|---|---|---|---|
| Pessimistic | Lock row before deciding/writing | Direct reasoning under hot-account contention | Waiting, potential deadlocks, longer lock duration |
| Optimistic | Read version; update only if version unchanged | No blocking on read; good when conflicts are rare | Conflict exceptions, bounded retries, more idempotency complexity |

TallyVault selects pessimistic locking because funds checks and account updates are short and conflict correctness is easier to demonstrate. That is a scoped decision, not a universal claim that pessimistic is faster.

### Idempotency

Idempotency means retrying the same logical command has the same financial effect as sending it once. It is not just HTTP duplicate detection. TallyVault binds the key to a normalized request hash and resulting transaction.

The naive race is:

1. A calls `exists(key)` → false.
2. B calls `exists(key)` → false.
3. A and B both insert transfers.

TallyVault lets the primary-key constraint decide the winner. A duplicate identical request reads and returns the winner; a changed payload gets `409`.

### Race conditions and deadlocks

A race condition occurs when correctness depends on unpredictable interleaving. The overspending example is a check-then-act race on balance. A deadlock occurs when transactions wait in a cycle. `A → B` locking A then B and `B → A` locking B then A is the classic cycle. TallyVault sorts UUIDs so both paths lock the same first row.

Ordering reduces deadlocks created by this code, but does not justify saying deadlocks are impossible. Production clients should use bounded retries for transient database deadlock/serialization failures while preserving the idempotency key.

### Reversal and immutable history

Deleting or editing a completed transfer erases evidence and can make old statements change. A reversal appends a new transaction with the opposite economic effect and references the original. Both remain balanced and inspectable. TallyVault locks the original and has a unique reversal link, so concurrent admin requests cannot create two compensations.

## Feature-by-feature defense

### 1. Money representation and validation

- **Problem:** fractional values, negative/zero transfers, excess precision, and overflow must not silently corrupt value.
- **Implementation:** `Money.requirePositive`, DTO `@DecimalMin/@Digits`, `BigDecimal` scale 2/no rounding, SQL `NUMERIC(19,2)` and positive-entry check.
- **Important code:** `Money`, `TransferDtos.TransferRequest`, `LedgerPostingService`.
- **Tables:** `accounts.cached_balance`, `ledger_entries.amount`.
- **Alternative:** store minor units as `long`; excellent for a single known currency, but still needs currency/overflow rules.
- **Failure cases:** `0`, negative, `1.001`, amount above column precision, currency mismatch.
- **Tradeoff:** fixed scale 2 is understandable but excludes currencies with other minor units.
- **Likely question:** “Why `RoundingMode.UNNECESSARY`?” **Answer:** a transfer should not silently change caller value; callers must submit an already valid minor-unit amount.

### 2. Double-entry posting

- **Problem:** balance-only changes are hard to audit and can become one-sided.
- **Implementation:** a header starts `PROCESSING`; `LedgerPostingService` appends equal DEBIT/CREDIT entries and changes both cached balances; completion is DB-validated.
- **Important code:** `LedgerTransaction`, `LedgerEntry`, `LedgerPostingService`.
- **Tables:** `ledger_transactions`, `ledger_entries`, `accounts`.
- **Alternative:** derive balances only from entries; simpler source of truth but potentially more expensive hot reads.
- **Failure cases:** missing leg, unequal leg, wrong entry type/account, crash during posting.
- **Tradeoff:** cached balance improves and simplifies locked funds checks but needs reconciliation.
- **Likely question:** “Does equal debit/credit guarantee correctness?” **Answer:** it guarantees internal balance, not correct business authorization or account selection; those have separate validations/tests.

### 3. Atomic transfer

- **Problem:** a failure after debit but before credit must not leave partial state.
- **Implementation:** one Spring `@Transactional` service method covers all writes; runtime failures propagate; PostgreSQL commits at the end.
- **Important code:** `TransferCreationService.create`, `ApiExceptionHandler`.
- **Tables:** transaction, entries, accounts, idempotency.
- **Alternative:** manual JDBC transaction; more explicit but more boilerplate in this JPA project.
- **Failure cases:** destination disappears, check violation, trigger rejection, unexpected exception before completion.
- **Tradeoff:** transactions hold locks; keep work short and do not call external services inside them.
- **Likely question:** “Why is `@Transactional` on a separate service?” **Answer:** Spring proxy interception must surround the call; separating creation from the outer collision handler also lets the failed transaction fully roll back before replay lookup.

### 4. Concurrent balance protection

- **Problem:** two requests can both pass a stale sufficient-funds check.
- **Implementation:** load both rows `PESSIMISTIC_WRITE`, then validate funds and update while locks are held.
- **Important code:** `AccountLockService`, `AccountRepository.findByIdForUpdate`, `TransferCreationService.validateAccounts`.
- **Tables:** `accounts`.
- **Alternative:** optimistic version with retry or a conditional atomic balance update. Both can work but need careful two-account/ledger composition.
- **Failure cases:** timeout, deadlock, long transaction, lock order regression.
- **Tradeoff:** correctness is easy to trace; contention queues requests on a hot account.
- **Likely question:** “Why not check balance before locking?” **Answer:** an early check can be only a hint. The decisive check must use the protected current row after the lock.

### 5. Deterministic lock order

- **Problem:** opposite-direction transfers may lock the same rows in reverse order and deadlock.
- **Implementation:** sort UUID strings, lock first then second, then map them back to source/destination semantics.
- **Important code:** `AccountLockService`.
- **Tables:** `accounts`.
- **Alternative:** one SQL query locking `WHERE id IN (...) ORDER BY id`; also valid and potentially fewer round trips.
- **Failure cases:** another code path locks unsorted; more than two rows need the same global ordering rule.
- **Tradeoff:** two simple queries are readable; a batch lock might be more efficient but less transparent in JPA.
- **Likely question:** “Are deadlocks now impossible?” **Answer:** no. This removes the known account-pair cycle; databases can still detect cycles involving other resources.

### 6. Idempotent transfer

- **Problem:** clients retry after timeouts and may not know whether the first request committed.
- **Implementation:** insert a key/hash/transaction row in the same transaction; collision rolls the losing work back; a new transaction replays the winner.
- **Important code:** `TransferService`, `TransferCreationService`, `IdempotencyReplayService`, `RequestHasher`.
- **Tables:** `idempotency_records` primary key and unique transaction FK.
- **Alternative:** Redis `SETNX`; it adds another consistency system and still needs coordination with PostgreSQL.
- **Failure cases:** same key/different payload, concurrent collision, first transaction rolls back, indefinite key retention.
- **Tradeoff:** durable/simple consistency, at the cost of retained rows and a required cleanup policy later.
- **Likely question:** “Why store a hash?” **Answer:** a key must not silently return an unrelated earlier result when its request body changes.

### 7. Reversal

- **Problem:** financial corrections must preserve original history and resist double execution.
- **Implementation:** admin route locks the original, verifies eligibility, locks accounts, appends inverse entries, and stores a unique original link.
- **Important code:** `ReversalService`, `TransactionController`.
- **Tables:** `ledger_transactions.reversal_of_transaction_id`, new `ledger_entries`.
- **Alternative:** mutable status/cancel on original; unacceptable after settlement because it erases the economic path. Pre-completion cancellation would be a different feature.
- **Failure cases:** already reversed, receiver spent funds, original not a two-leg transfer, account closed, concurrent requests.
- **Tradeoff:** requiring refund funds may need an operational exception process in a real institution; TallyVault refuses hidden overdraft.
- **Likely question:** “Why can frozen accounts reverse?” **Answer:** freeze blocks ordinary user movement; an explicit authorized correction may need to restore value. Closed accounts remain blocked. This is a documented policy choice.

### 8. Immutability and database invariants

- **Problem:** API restrictions alone do not stop a repository bug or direct SQL from rewriting history.
- **Implementation:** Flyway installs append-only and completed-header triggers plus a deferred balance constraint trigger.
- **Important code:** `V1__create_ledger_schema.sql`.
- **Tables:** `ledger_transactions`, `ledger_entries`.
- **Alternative:** database permissions granting INSERT-only access; useful additional production defense but more deployment administration.
- **Failure cases:** migration disabled, privileged DBA bypass, `PROCESSING` rows abandoned after a crash.
- **Tradeoff:** PostgreSQL-specific triggers improve integrity but reduce database portability. Portability is not a goal here.
- **Likely question:** “Why deferred?” **Answer:** after the first leg the transaction is temporarily unbalanced; validate after all statements, at commit.

### 9. Cached balance and reconciliation

- **Problem:** summing a long entry history on every display/funds check is costly, while a cache can drift.
- **Implementation:** update cache atomically with entries; balance endpoint independently computes `credits - debits` and returns consistency.
- **Important code:** `Account`, `LedgerEntryRepository.calculateBalance`, `AccountService.balance`.
- **Tables:** `accounts`, `ledger_entries`.
- **Alternative:** no cache, or asynchronously maintained projection. The latter creates lag and infrastructure that this project avoids.
- **Failure cases:** direct entry insert without balance update, migration bug, manual repair.
- **Tradeoff:** efficient locked decision plus extra invariant to monitor.
- **Likely question:** “Which is source of truth?” **Answer:** immutable ledger entries; cached balance is a synchronous projection and is explicitly reconciled.

### 10. Authentication and authorization

- **Problem:** account data and money movement require both identity and object-level access control.
- **Implementation:** BCrypt registration/login, HMAC JWT filter, USER/ADMIN method rules, service ownership checks.
- **Important code:** `SecurityConfig`, `JwtAuthenticationFilter`, `CurrentUser`, account/query services.
- **Tables:** `app_users`, account ownership FK.
- **Alternative:** server sessions; entirely reasonable for one backend, but JWT makes the separate demo client simple.
- **Failure cases:** stolen token, secret leakage, missing revocation, role/object check omission.
- **Tradeoff:** stateless access is convenient but this demo lacks refresh/revocation/MFA.
- **Likely question:** “Is it bank-grade?” **Answer:** no. It demonstrates core access control and documents missing controls without compliance claims.

### 11. Testing strategy

- **Problem:** concurrency and constraints cannot be proven by happy-path mocked units alone.
- **Implementation:** fast unit tests for value/isolated service behavior and Testcontainers integration tests against PostgreSQL for triggers, transactions, HTTP security and races.
- **Important code:** `LedgerCriticalPathsIntegrationTest`, unit test package, CI workflow.
- **Tables:** all core tables are exercised.
- **Alternative:** H2 integration tests; rejected because its locks, SQL types, triggers and constraint behavior differ from PostgreSQL.
- **Failure cases:** flaky timing-only tests, shared state, Docker unavailable, asserting exceptions without final database state.
- **Tradeoff:** Testcontainers is slower but tests the mechanisms the project claims.
- **Likely question:** “How is concurrency synchronized?” **Answer:** a `CountDownLatch` releases worker threads together; futures have timeouts; assertions inspect successes, balances and ledger state.

## Fifteen likely interviewer questions

1. **Walk me through one transfer.** Validate → claim idempotency → lock sorted accounts → revalidate → append equal legs/update cache → complete → DB trigger → commit.
2. **Where is debit-equals-credit enforced?** In posting code, a deferred PostgreSQL trigger, and integration assertions.
3. **Why isn't `sender.balance -= amount` enough?** It has no immutable accounting evidence and can become one-sided; the balance is only a projection here.
4. **How does the ₹1,000/two-₹800 race behave?** The first lock holder commits; the waiter then sees ₹200 and fails its post-lock funds check.
5. **What is the idempotency linearization point?** Successful insertion of the idempotency primary key inside the transaction.
6. **What happens if the first request fails after claiming the key?** Its whole transaction rolls back, including the key, so a later valid attempt can claim it.
7. **Why catch the unique violation outside the transactional method?** A failed transaction is rollback-only; replay needs a clean `REQUIRES_NEW` read.
8. **What if a key is reused with another amount?** Its request hash differs, so return `409` without new financial work.
9. **Why lock destination too?** Its balance changes and opposite-direction transfers share it; locking both gives consistent updates/order.
10. **Can deterministic ordering eliminate all deadlocks?** No; it eliminates the known account-pair order inversion, not cycles involving unrelated locks.
11. **Why a reversal instead of delete?** It preserves original evidence and expresses correction as another balanced, auditable transaction.
12. **What if Bob already spent Alice's transfer?** Reversal fails for insufficient refund funds; the system does not silently overdraft. An operational resolution flow is out of scope.
13. **How do you know the cached balance is correct?** It updates atomically, a DB check prevents negative customer balances, and the endpoint/test compares it with ledger-derived balance.
14. **Why Testcontainers?** Correctness depends on PostgreSQL-specific locking, triggers and deferred constraints that an in-memory substitute would not faithfully test.
15. **What would you build next?** Reconciliation reporting and admin audit first, measured tuning second, security token lifecycle third—not microservices without a concrete need.

## Before putting this on a resume

You should be able to:

- write the two SQL entries for a transfer and reversal by hand;
- explain the exact `@Transactional` proxy boundary and rollback behavior;
- reproduce the check-then-insert and overspending interleavings on a whiteboard;
- explain `READ COMMITTED` plus `FOR UPDATE` without saying isolation magically solves everything;
- point to every relevant SQL constraint/trigger and state what it cannot prove;
- compare optimistic and pessimistic locking fairly;
- run the integration suite and inspect the database after a failure;
- explain why every status code and USER/ADMIN permission was chosen;
- state the known limitations without defensiveness;
- show raw benchmark evidence before using any metric.
