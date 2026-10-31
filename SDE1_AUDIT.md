# Final SDE-1 Audit

Audit date: 2026-08-20. Scores judge demonstrated, inspectable project evidence—not what could be claimed after future work.

## Scorecard

| Area | Score / 10 | Evidence and gap |
|---|---:|---|
| Java fundamentals | 8 | Records/DTOs, enums, `BigDecimal`, exceptions, collections, streams and clear object boundaries; intentionally no algorithm-heavy domain |
| Spring Boot | 8 | MVC, Security, Validation, JPA, transactions, Flyway, Actuator, configuration, Testcontainers |
| REST API design | 8 | Resource paths, DTOs, pagination, ownership, deliberate status codes, centralized errors; no versioning/contract generation |
| PostgreSQL/database design | 9 | Numeric precision, FKs, checks, unique/partial indexes, deferred invariant and immutability triggers |
| Transaction knowledge | 9 | One explicit atomic boundary, rollback test, flush/constraint behavior, no external call inside transaction |
| Concurrency | 9 | Post-lock validation, pessimistic locks, deterministic order, duplicate-key arbitration and race tests |
| Financial correctness | 9 | Genuine balanced entries, source-of-truth ledger, cache reconciliation, immutable completion and compensating reversal |
| Testing | 8 | Thirteen verified unit tests plus critical PostgreSQL/HTTP/concurrency integration suite; local environment could not execute Docker-dependent tests |
| Frontend integration | 8 | Typed responsive dashboard, guided transfer, searchable history, transaction proof and admin flows with accessible reduced-motion-aware interactions; component/e2e tests remain limited and browser token storage is demo-only |
| Docker/deployment | 7 | Multi-stage Dockerfiles, Compose health/dependencies, env example and CI; not locally exercised because no Docker daemon was present |
| Interview defensibility | 9 | Small traceable design, explicit tradeoffs, direct tests, honest limits and dedicated guide |

Overall signal: **a fresher deeply explored transaction correctness and database concurrency.** The project does not need more technology to improve its score; it needs execution evidence for the existing integration/benchmark paths.

## 1. Is anything unnecessarily SDE-2/SDE-3?

No infrastructure is. The deferred PostgreSQL constraint trigger and deterministic multi-row locking may sound advanced, but they directly enforce the core ledger/race invariants and are explained/tested. They are engineering depth, not organizational architecture.

The self-built JWT layer is the one area to avoid over-selling. It is acceptable portfolio scope, but a real financial product would use a mature identity service and additional controls. It remains small here.

## 2. Is anything too tutorial-like?

Basic registration/login and account CRUD are familiar tutorial material in isolation. They are supporting features, not the differentiator. The project moves beyond tutorial level through:

- database-enforced balanced/append-only rules;
- concurrency tests using real PostgreSQL;
- idempotency collision handling rather than a boolean pre-check;
- compensating reversal with a concurrent uniqueness defense;
- cached-versus-derived balance reconciliation.

To avoid weakening the presentation, demo the two-₹800 race and a reversal before spending time on the login form.

## 3. Is every technology justified?

| Technology | Justification |
|---|---|
| Java 17 / Spring Boot | Target-role stack and compact web/transaction/security framework |
| Spring MVC/Validation | REST representation and boundary validation |
| JPA/Hibernate | Entity mapping and pessimistic locking while retaining explicit SQL invariants |
| Spring Security/JWT/BCrypt | Separate React client and two-role authorization demonstration |
| PostgreSQL | Transactions, row locks, numeric precision, constraint triggers and Testcontainers fidelity |
| Flyway | Reviewable/repeatable schema and invariants |
| React/TypeScript/Tailwind | Small usable recruiter demo; TypeScript limits API-shape mistakes |
| JUnit/Mockito/Testcontainers | Fast unit tests plus genuine database behavior |
| Docker Compose | Five-minute reproducible UI/API/database setup |
| GitHub Actions | Repeatable build/test evidence |
| Node benchmark script | Dependency-free, machine-readable measurements without invented claims |

No Kafka, Redis, Kubernetes, cloud platform, CQRS, multiple database, or metrics stack is justified, so none is included.

## 4. Can every resume bullet be proven?

Version A can be traced to source files, migrations, Compose/CI configuration, and tests. Its wording says tests were added, not that all integration cases passed in this Docker-less workspace.

Version B is deliberately withheld. It must not be used until `docs/BENCHMARK_RESULTS.md` contains real environment metadata, raw JSON, multiple runs, failures and observed values.

## 5. Are the ledger invariants actually enforced?

Yes, for the defined scope:

- service posts one positive debit and one equal positive credit;
- deferred database trigger rejects completed work with fewer than two entries or unequal totals;
- types/amounts/references have checks and foreign keys;
- completed transaction and entry immutability is trigger-enforced;
- unique reversal link permits one compensating transaction;
- normal-account cached balances cannot be negative.

Boundary: the database permits a balanced transaction with more than two entries; this is useful accounting generality. Application flows currently create exactly two. The trigger proves balance, not ownership/intent or that the correct accounts were chosen.

## 6. Can concurrent requests corrupt balances?

Through the implemented transfer/reversal services, the design prevents the known corruption paths: both account rows are locked, balances are checked after locking, entries and caches update in one transaction, and customer balances have a nonnegative check. Opposite directions use one ordering rule.

No honest system says corruption is mathematically impossible under every future code change, privileged SQL action, hardware fault, or misconfiguration. The repository adds database constraints and reconciliation specifically so application regressions are more likely to fail or be detected.

## 7. Can duplicate requests create duplicate transactions?

The same idempotency key cannot commit twice because it is the table primary key and its transaction link is unique. Concurrent identical submissions converge on the committed transaction. A changed body with the same key conflicts.

Different keys represent different commands by design; semantic duplicate detection across unrelated keys is not promised. Key retention currently has no cleanup policy.

## 8. Can transaction history be improperly modified?

Normal APIs expose no entry/transaction update or delete. PostgreSQL also rejects entry update/delete, late entry insertion, and completed-header update/delete. Corrections append reversals.

A database superuser can alter/disable triggers; preventing privileged administrative tampering requires operational access controls beyond this portfolio.

## 9. Fifteen most likely interview questions

1. What makes this double-entry rather than two balance updates?
2. Where and when is debit-equals-credit enforced?
3. Why use `BigDecimal` and what scale/rounding policy applies?
4. What exactly is inside the transfer transaction boundary?
5. How does rollback avoid a one-sided transfer?
6. Show the interleaving that permits two ₹800 spends from ₹1,000 without locking.
7. Why did you choose pessimistic rather than optimistic locking?
8. Why lock both accounts, and why in sorted order?
9. Does deterministic ordering eliminate every deadlock?
10. Why is `exists(key)` followed by `insert` unsafe?
11. What binds an idempotency key to its original request?
12. Why does duplicate replay happen in a new transaction?
13. Why append a reversal rather than update/delete the original?
14. Which invariants are in Java versus PostgreSQL, and why both?
15. What did you actually benchmark, and can you show the raw evidence?

Concise model answers and follow-ups are in `docs/INTERVIEW_GUIDE.md`.

## 10. What must be understood before putting this on a resume?

You must be able to explain, without reading code:

1. The debit/credit entries and balance effects for transfer, funding and reversal.
2. Why ledger equality is necessary but not sufficient for correct authorization/intent.
3. `BigDecimal` construction, comparison, scale and rounding behavior.
4. Spring proxy-based `@Transactional` boundaries, rollback-only state, flush versus commit.
5. PostgreSQL `READ COMMITTED` and what `FOR UPDATE` adds.
6. The overspending and idempotency race interleavings.
7. Pessimistic/optimistic alternatives and contention tradeoffs.
8. Deadlock formation, deterministic ordering, and bounded retry principles.
9. Every important unique/check/FK/trigger in the migration.
10. Why the cache is not the accounting source of truth and how reconciliation detects drift.
11. Reversal eligibility, insufficient refund funds, and the uniqueness race.
12. USER versus ADMIN permissions and object-level authorization.
13. What each critical test proves—and what it does not prove.
14. How to run the stack/test suite and inspect a failed database state.
15. The exact known limitations and why “bank-grade,” “production-ready,” and scalability claims are unjustified.

## Final recommendation

Safe to present as an SDE-1 portfolio project after the candidate personally runs the full Testcontainers suite and can explain its failures. Safe to use Version A resume bullets now based on implementation facts. Do not use Version B or any throughput/reliability metric until the benchmark tables and raw JSON are populated from a controlled run.
