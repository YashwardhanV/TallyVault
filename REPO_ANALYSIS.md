# Reference Repository Analysis

Analysis date: 2026-08-20. This document records concepts studied before the independent TallyVault implementation. It is not a claim of authorship over any reference code.

References:

- Primary: [AryanDevCodes/double-ledger-banking-system](https://github.com/AryanDevCodes/double-ledger-banking-system)
- Correctness/concurrency: [hirashif/ledger](https://github.com/hirashif/ledger)
- Conceptual: [mkmbhs/ledger](https://github.com/mkmbhs/ledger)

## Classification key

| Class | Meaning |
|---|---|
| **A — MUST KEEP** | Strong, explainable SDE-1 signal needed for ledger correctness |
| **B — NICE TO HAVE** | Useful depth if it remains small and testable |
| **C — REMOVE** | Scope/infrastructure cost outweighs the portfolio signal |
| **D — REPLACE** | Keep the engineering idea, implement it with simpler local infrastructure |

The classification concerns TallyVault's scope, not the quality of the reference projects. Database locks, constraints, idempotency, isolation, and immutable ledgers are class A because they are core correctness techniques—not “too senior” technologies.

## 1–15. Repository findings

| # | Dimension | Primary repository | `hirashif/ledger` | `mkmbhs/ledger` | TallyVault decision |
|---:|---|---|---|---|---|
| 1 | Existing architecture | Broad Spring Boot backend and React frontend for a banking product | Compact Spring Boot REST service organized around ledger operations | Go ledger service with HTTP/gRPC surfaces and storage abstractions | **A:** one Spring Boot modular monolith + React |
| 2 | Main modules/services | Auth, users, accounts, transfers/ledger plus cards, loans, UPI, notifications, admin and analytics | Accounts, transactions, entries, idempotency, reconciliation | Accounts, transfers, holds, multi-leg entries, adapters, outbox and monitoring | **A:** auth/account/transfer/ledger/transaction; **C:** unrelated banking products |
| 3 | Database/storage | PostgreSQL through Spring Data JPA/Hibernate; optional Redis behavior exists in the broader app | PostgreSQL with Spring JDBC and explicit SQL | PostgreSQL plus an in-memory store/conformance layer | **A:** PostgreSQL/JPA only; **C:** second store |
| 4 | External infrastructure | Dockerized web/database and optional cache/integration concerns | PostgreSQL/Testcontainers, deliberately little else | Kafka, Prometheus/Grafana, gRPC tooling and load tooling | **C:** brokers/metrics stack; **D:** keep load evidence via one Node script |
| 5 | Authentication | JWT-based Spring Security with multiple banking roles | Ledger core emphasizes accounting rather than a feature-rich identity system | Core service concerns dominate; auth is not the learning focus | **A:** JWT + BCrypt + USER/ADMIN only |
| 6 | Important domain entities | Users, accounts, transactions, ledger records and many banking-product entities | Account, transaction, entry, idempotency/reconciliation concepts | Accounts, transfers, entries, holds, outbox records | **A:** User, Account, LedgerTransaction, LedgerEntry, IdempotencyRecord; **C:** holds/cards/loans |
| 7 | Ledger/accounting model | Transfer writes debit/credit ledger records and account state | Append-only entries, balanced transaction enforcement, cached/derived balance reconciliation | Multi-leg double-entry model with store contracts | **A:** balanced two-leg entries + cache reconciliation; **B:** general multi-leg model deferred |
| 8 | Important APIs | Large banking API: auth, accounts, transfers, admin, cards, loans, UPI and more | Small account/transaction/ledger API surface | REST and gRPC operations for a richer ledger | **A:** auth, accounts, transfers, histories, reversal; **C:** duplicate protocols/products |
| 9 | Transaction handling | Spring transactions group money movement and ledger writes | Explicit database transactions; complete transaction checked at commit | Storage-layer transaction abstractions and outbox coordination | **A:** one local ACID transaction; **C:** distributed coordination |
| 10 | Concurrency | Pessimistic account locking and deterministic lock helpers are present | Sorted account IDs with `SELECT ... FOR UPDATE`; concurrency tests | Store-level concurrency controls across richer operations | **A:** sorted pessimistic row locks; easiest correct SDE-1 explanation |
| 11 | Idempotency | Unique UPI/idempotency data appears inside a much broader flow | Unique key, request hash, insert-and-replay behavior | Request identity and outbox delivery concerns | **A:** DB primary key + request hash; **D:** no Redis/distributed dedupe |
| 12 | Failure handling | Central errors and many product-specific failure states | Rollback, constraint violations and reconciliation expose bad states | Retries/outbox/adapter errors support distributed integrations | **A:** rollback + typed API errors; **C:** distributed retry machinery |
| 13 | Testing strategy | Spring tests across broad application features | PostgreSQL Testcontainers, concurrency and invariant-focused tests | Store conformance, load/fuzz testing and component tests | **A:** small critical-path unit/integration suite; **B:** focused load harness |
| 14 | Docker/deployment | Docker/Compose for the full stack | PostgreSQL-oriented local/test setup | Multi-component Compose/monitoring setup | **A:** Compose with UI/API/PostgreSQL; **C:** orchestration beyond Compose |
| 15 | Performance features | Caching/pagination and broad product endpoints | Cached balances, useful indexes, reconciliation and bounded DB access | Benchmark/load tooling, multiple protocols, monitoring stack | **A:** indexes/pagination; **B:** measured load tests; **C:** speculative scale claims |

## Significant feature classification and rationale

| Reference concept | Class | Why and independent TallyVault treatment |
|---|---|---|
| One local ACID transaction per transfer | **A — MUST KEEP** | Prevents one-sided money movement. `TransferCreationService.create` owns the boundary. |
| Debit/credit entries instead of balance-only mutation | **A — MUST KEEP** | The central accounting signal. Balances are a cache; entries are the audit trail. |
| `BigDecimal` / fixed-precision SQL numeric | **A — MUST KEEP** | Floating point cannot represent decimal money reliably. Scale 2 is explicit and implicit rounding is rejected. |
| PostgreSQL foreign keys/checks/indexes | **A — MUST KEEP** | Database integrity must survive application bugs and concurrent requests. |
| Deferred balanced-transaction constraint | **A — MUST KEEP** | Allows entries to be assembled in a transaction but rejects an unbalanced completed transaction at commit. |
| Append-only ledger enforcement | **A — MUST KEEP** | History cannot be silently rewritten; triggers reject entry update/delete. |
| Pessimistic account row locks | **A — MUST KEEP** | Makes the ₹1,000 / two ₹800 request race straightforward to reason about. Validation occurs after locks. |
| Deterministic lock order | **A — MUST KEEP** | Opposite-direction transfers otherwise create a classic deadlock cycle. Sorted UUIDs reduce that risk. |
| Database-enforced idempotency key | **A — MUST KEEP** | `exists` then `insert` races. The primary key is the arbiter; an identical collision replays the result. |
| Request hash bound to idempotency key | **B — NICE TO HAVE** | Small addition that prevents one key from ambiguously representing different transfers. Included. |
| Cached balance plus ledger-derived reconciliation | **B — NICE TO HAVE** | Fast reads remain understandable when the derived value is exposed for verification. Included without a repair platform. |
| Two-role JWT security | **A — MUST KEEP** | Demonstrates authentication/authorization without reproducing a bank's role hierarchy. |
| Compensating reversal | **A — MUST KEEP** | Corrects economic effect without deleting history. A unique link prevents double reversal. |
| Admin action audit log | **B — NICE TO HAVE** | Useful, but not required to prove ledger correctness. Deferred to keep scope tight. |
| Cards, loans, UPI, beneficiaries, notifications, webhooks | **C — REMOVE** | These multiply CRUD and integration paths while diluting the transaction/concurrency lesson. |
| Holds and multi-leg/fee/FX workflows | **C — REMOVE** | Valid real-world concepts but add state machines not required for the chosen two-leg wallet scope. |
| Redis caching/rate limiting | **C — REMOVE** | A second consistency boundary is unjustified here; PostgreSQL handles the necessary state. |
| Kafka/outbox consumers | **D — REPLACE** | Reliable event delivery is valuable for external integrations, but TallyVault has none. The local transaction remains the source of truth; add an outbox only when a real consumer exists. |
| gRPC alongside REST | **C — REMOVE** | Two protocols double interface/testing work without improving this portfolio's correctness story. |
| Prometheus/Grafana stack | **D — REPLACE** | Keep observable evidence through Actuator health, test reports, and a repeatable JSON benchmark; omit a monitoring deployment. |
| In-memory and PostgreSQL store conformance | **C — REMOVE** | Multiple storage engines add abstraction depth while the assignment specifically targets PostgreSQL behavior. |
| Kubernetes, Helm, service discovery, API gateway | **C — REMOVE** | No independent services exist, so this is architecture without a problem. Docker Compose is sufficient. |
| Load/fuzz tooling | **B — NICE TO HAVE** | Repeatable evidence is useful. TallyVault includes one dependency-free Node harness and refuses fabricated results. |

## Independent design conclusion

The strongest common lesson is not “build more banking modules.” It is that correctness needs overlapping defenses: application validation, a single database transaction, row locking, unique/check/foreign-key constraints, immutable history, and adversarial tests. TallyVault keeps those mechanisms visible in a codebase a fresher can trace end to end.

The implementation intentionally does not preserve reference package names, product breadth, storage abstractions, or infrastructure. Its simplified two-entry wallet model, API DTOs, database migration, tests, frontend, and documentation were created for this project.
