# Cloudflare D1 Architecture and Separation of Concerns

This document defines how this repository uses Cloudflare D1 for scale, performance, and reliability.

D1 uses SQLite semantics with serialized writes per database. The platform must optimize for read-heavy behavior and constrained write pipelines.

## Core Principles

1. Prefer reads over writes.
2. Minimize per-request writes.
3. Batch and aggregate where possible.
4. Separate D1 databases by write workload.
5. Keep rows and indexes small.
6. Use retention and cleanup for all growth-prone tables.

## Database Segmentation in This Repo

Use dedicated D1 databases with dedicated Drizzle configs and migration directories:

- `AUTH_DB`
  - Drizzle config: `drizzle.config.auth.ts`
  - Migrations: `drizzle/migrations/auth`
  - Tables: `user`, `session`, `account`, `verification`
- `BILLING_DB`
  - Drizzle config: `drizzle.config.billing.ts`
  - Migrations: `drizzle/migrations/billing`
  - Tables: `credit_balance_profiles` and billing state tables
- `ANALYTICS_DB`
  - Drizzle config: `drizzle.config.analytics.ts`
  - Migrations: `drizzle/migrations/analytics`
  - Tables: `quote_requests`, `moderation_rejections`, aggregate usage/reporting tables
- `METADATA_DB`
  - Drizzle config: `drizzle.config.metadata.ts`
  - Migrations: `drizzle/migrations/metadata`
  - Tables: `deapi_pricing_snapshots`, `deapi_pricing_permutations`, `tina_level_entries`, `hot_cold_*`

Compatibility fallback bindings (`APP_DB`, `TINA_DB`) may exist during migration but must not be the long-term primary architecture.

## Table Design Rules

- Keep rows small and bounded.
- Avoid unbounded JSON blobs and log-style append-only tables.
- Index only fields used by real query filters/sorts.
- Prefer aggregate tables over high-cardinality event streams.

## Write Optimization Rules

- Avoid immediate per-request writes for telemetry and counters.
- Prefer buffered batching and periodic flush.
- Use idempotent `UPSERT` patterns for aggregate counters.
- Use D1 `batch` where multiple writes are required in one operation.

## Read Scaling Rules

- Design for SELECT-heavy traffic.
- Cache read-heavy static data in KV/edge cache when possible.
- Good cache candidates:
  - pricing snapshots
  - model metadata
  - public configuration

## Auth DB Rules

- Keep auth DB low-write and highly indexed.
- Session records must expire and be periodically cleaned.
- Do not store large profile payloads in auth tables.

## Billing DB Rules

- Keep billing writes consistent and minimal.
- Avoid per-request balance mutation when an aggregate window is possible.
- Preserve immutable billing-critical facts before archival.

## Snapshot and Metadata Rules

- Snapshot tables are preferred for read-heavy immutable datasets.
- Keep recent snapshots hot in D1 and archive older slices as needed.

## Retention and Cleanup

Each growth-prone table must have explicit retention.

Examples:

- Session cleanup: delete expired sessions on a periodic cadence.
- Pricing snapshots: retain only recent snapshots in hot storage.
- Event-like data: aggregate first, archive or delete raw detail after verification.

## Query Pattern Rules

Prefer:

- indexed predicates
- bounded result sets (`LIMIT`)
- paginated scans

Avoid:

- full-table scans on hot paths
- unbounded list endpoints

## Migration Safety

Follow additive-first rollouts:

1. add new columns/tables
2. deploy app using new structures
3. backfill data in controlled jobs
4. remove old structures only after validation

## Anti-Patterns to Avoid

- every request writes to D1
- D1 as a queue
- D1 as raw high-frequency telemetry store
- large append-only log tables in primary operational DBs

Use batching, aggregation, database segmentation, and edge caching instead.

## Target Envelope

Design around conservative write throughput per database and keep sustained writes below saturation levels. Use additional databases and workload partitioning before approaching write ceilings.
