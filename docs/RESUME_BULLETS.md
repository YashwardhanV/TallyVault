# Resume Bullets

## Version A — No metrics

- Built TallyVault, a Java 17/Spring Boot and React/TypeScript wallet engine backed by PostgreSQL, with JWT role-based access, Flyway migrations, Docker Compose, and paginated REST APIs.
- Implemented atomic double-entry transfers using `BigDecimal`, balanced debit/credit records, deterministic pessimistic row locking, database constraints, and append-only transaction history with compensating reversals.
- Prevented retry duplication with request hashing and a database-unique idempotency key, and added JUnit 5/Mockito plus PostgreSQL Testcontainers tests for rollback, overspending races, duplicate keys, deadlocks, authorization, and reversal races.

## Version B — Benchmarked (not yet publishable)

- **WITHHELD:** Do not use a benchmarked project/scope bullet until `BENCHMARK_RESULTS.md` identifies the executed environment, commit, dataset, and run date.
- **WITHHELD:** Replace this line only with the observed concurrent overspending/idempotency request counts and integrity outcomes from retained JSON results; no such measurement is currently recorded.
- **WITHHELD:** Replace this line only with measured successful throughput, p50/p95 latency, run count, and failures from the recorded workload; no such measurement is currently recorded.

Version B deliberately contains no numbers. The 13 local unit-test successes and frontend build statistics are qualification evidence, not a substitute for an API/PostgreSQL load run.
