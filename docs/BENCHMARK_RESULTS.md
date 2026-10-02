# Benchmark Results

## Publication status

**No transfer load benchmark has been executed or published yet.** The implementation workspace does not provide a Docker daemon, so PostgreSQL/Testcontainers and the running Compose stack were unavailable. Reporting throughput, latency, request totals, or “zero invalid balances” without executing the workload would be fabricated.

This file is intentionally a benchmark record, not marketing copy. `docs/RESUME_BULLETS.md` withholds its benchmarked version until this record contains real JSON-backed runs.

## Environment qualification recorded on 2026-08-20

These are build checks, not load-test results:

| Item | Observed value |
|---|---|
| OS/kernel | Linux 6.18.35 x86_64 |
| Available processors | 9 |
| Java | OpenJDK 17.0.19 |
| Node.js | v24.19.0 |
| npm | 11.9.0 |
| PostgreSQL | Not started locally; Compose/Testcontainers target `postgres:16-alpine` |
| Backend unit tests | 13 passed, 0 failed across money, hashing, account state, posting, transfer validation and reversal tests |
| Backend PostgreSQL integration tests | Not executed locally; Docker unavailable |
| Frontend production build | Passed after TallyVault UI revamp; 1,599 modules transformed; JS bundle 247.05 kB (74.32 kB gzip) |

Bundle size is recorded only as build output and is not a backend performance claim.

## Required controlled run

Use a fresh checkout and do not browse the UI during the run:

```bash
cp .env.example .env
docker compose down -v
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:8080/actuator/health
```

Record the following before testing:

| Field | Value to record |
|---|---|
| Date/time and timezone | Pending |
| Machine/VM model | Pending |
| OS | Pending |
| CPU model/logical cores | Pending |
| RAM | Pending |
| Java image/version | Pending |
| PostgreSQL exact version | Pending |
| Docker/Compose versions | Pending |
| Git commit | Pending |
| Dataset/account opening balances | Pending |
| Warm-up procedure | Pending |

## Transfer throughput protocol

Reset volumes before each request-size group. Perform one unreported warm-up, then at least three measured runs. The default amount is ₹0.01 so 10,000 successful requests fit comfortably within demo funds.

```bash
node benchmark/tallyvault-load.mjs --mode throughput --requests 100 --concurrency 10 \
  --output benchmark/results/throughput-100-run1.json
node benchmark/tallyvault-load.mjs --mode throughput --requests 1000 --concurrency 25 \
  --output benchmark/results/throughput-1000-run1.json
node benchmark/tallyvault-load.mjs --mode throughput --requests 10000 --concurrency 50 \
  --output benchmark/results/throughput-10000-run1.json
```

Do not combine results from a depleted dataset. Repeat with `run2` and `run3` filenames after a reset.

| Requests | Concurrency | Runs | Success | Rejected | Transport failures | req/s median | latency p50 | latency p95 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 10 | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 1,000 | 25 | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 10,000 | 50 | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Concurrent overspending protocol

Run against freshly seeded Alice/Bob accounts. The script reads Alice's current balance and submits transfers worth 60% of it, so two simultaneous successes would overspend.

```bash
node benchmark/tallyvault-load.mjs --mode overspend --requests 2 --concurrency 2 \
  --output benchmark/results/overspend-2.json
```

| Attempted | Successful | Insufficient-fund rejections | Other failures | Duplicate transactions | Invalid balances | Unbalanced completed ledgers |
|---:|---:|---:|---:|---:|---:|---:|
| Pending | Pending | Pending | Pending | Pending | Pending | Pending |

The JSON harness reports cache/derived consistency and negative balance state. Also run the integration suite, whose SQL assertion checks unbalanced completed transactions.

## Concurrent idempotency protocol

```bash
node benchmark/tallyvault-load.mjs --mode idempotency --requests 100 --concurrency 20 \
  --output benchmark/results/idempotency-100.json
```

| Requests sent | HTTP successes | Distinct transaction IDs | Replayed responses | Failures |
|---:|---:|---:|---:|---:|
| Pending | Pending | Pending | Pending | Pending |

Expected is one distinct ID, but expectation must not be copied into the result column.

## How to publish results honestly

1. Commit the raw `benchmark/results/*.json` files or attach them to a release; do not hand-edit raw evidence.
2. Calculate median across runs; report p95 per workload or state exactly how it was aggregated.
3. Include failures and rejections rather than counting only successes.
4. Repeat after code/config changes; do not compare unlike machines as an “improvement.”
5. Copy values into the tables and then replace the withheld benchmarked resume bullets.
6. Phrase the result as observed under this configuration, never as universal scalability.
