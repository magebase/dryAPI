# Cloudflare Shared Database Architecture

This repository uses a single shared relational database per app boundary. Do not split auth, billing, analytics, metadata, or settings into separate databases unless there is a hard isolation requirement.

## Core Principles

1. Prefer reads over writes.
2. Minimize per-request writes.
3. Batch and aggregate where possible.
4. Keep one database per application boundary.
5. Keep rows and indexes small.
6. Use retention and cleanup for growth-prone tables.

## Table Grouping in This Repo

Use one database and keep tables grouped by domain:

- Auth tables: `user`, `session`, `account`, `verification`, `apikey`
- Billing tables: `credit_balance_profiles`, `billing_credit_events`, `saas_monthly_token_buckets`
- Analytics tables: `quote_requests`, `moderation_rejections`, page-view aggregates
- Metadata tables: pricing snapshots, pricing permutations, Tina state, and other durable metadata tables

## Table Design Rules

- Keep rows small and bounded.
- Avoid unbounded JSON blobs and log-style append-only tables.
- Index only fields used by real query filters or sorts.
- Prefer aggregate tables over high-cardinality event streams.

## Write Optimization Rules

- Avoid immediate per-request writes for telemetry and counters.
- Prefer buffered batching and periodic flush.
- Use idempotent `UPSERT` patterns for aggregate counters.
- Use database `batch` operations where multiple writes are required.

## Read Scaling Rules

- Design for SELECT-heavy traffic.
- Cache read-heavy static data in KV or edge cache when possible.
- Good cache candidates:
  - pricing snapshots
  - model metadata
  - public configuration

## Table Rules

- Auth tables: keep them low-write and highly indexed. Session records must expire and be periodically cleaned.
- Billing tables: keep billing writes consistent and minimal. Avoid per-request balance mutation when an aggregate window is possible.
- Snapshot and metadata tables: prefer read-heavy immutable datasets. Keep recent snapshots hot and archive older slices as needed.

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

1. add new columns or tables
2. deploy app using new structures
3. backfill data in controlled jobs
4. remove old structures only after validation

## Anti-Patterns to Avoid

- splitting a single app into separate databases by domain when a shared database works
- every request writes to the database
- the database as a queue
- the database as a raw high-frequency telemetry store
- large append-only log tables in the primary operational database

Use batching, aggregation, and edge caching instead.

## Target Envelope

Design around conservative write throughput for the shared database and keep sustained writes below saturation levels. Introduce additional partitioning only when a measured bottleneck justifies it.
