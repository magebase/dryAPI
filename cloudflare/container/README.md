# Cal.com on Cloudflare Containers

This package deploys Cal.com to Cloudflare Containers with:

- single container instance running both Cal.com and PostgreSQL
- hourly Worker cron wake trigger (`0 * * * *`)
- daily PostgreSQL backup trigger (`15 2 * * *`)
- backup uploads to Cloudflare R2 using `STANDARD_IA` storage class
- BREVO-backed email configuration and SMS API key injection

## Architecture

- Worker entrypoint: `src/worker.ts`
- Container image: `Dockerfile`
- In-container process manager: `docker/supervisord.conf`
- Daily backup job: `docker/backup-postgres.sh`
- Internal control endpoints (wake + backup): `docker/internal-api.mjs`

Cal.com is proxied through an internal API process on port `3000`.
Cal.com itself runs on port `3001`; PostgreSQL listens on `127.0.0.1:5432`.

## Prerequisites

- Docker engine available locally for `wrangler deploy`
- Cloudflare Workers paid plan with Containers enabled
- Existing R2 bucket for backups

## Install and Deploy

```bash
pnpm --dir cloudflare/container install
pnpm --dir cloudflare/container deploy
```

## Required Secrets

Set these in the Worker linked to `cloudflare/container/wrangler.toml`:

```bash
cd cloudflare/container
wrangler secret put INTERNAL_CRON_TOKEN
wrangler secret put CALCOM_ADMIN_TRIGGER_TOKEN
wrangler secret put POSTGRES_PASSWORD
wrangler secret put BREVO_API_KEY
wrangler secret put BREVO_FROM_EMAIL
wrangler secret put BREVO_SMS_SENDER
wrangler secret put BREVO_SMS_WEBHOOK_TOKEN
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_BUCKET
wrangler secret put R2_ENDPOINT
wrangler secret put CALCOM_BASE_URL
wrangler secret put CALCOM_NEXTAUTH_SECRET
wrangler secret put CALCOM_ENCRYPTION_KEY
```

Optional but recommended when locking down private Cal.com routes:

```bash
wrangler secret put CALCOM_INTERNAL_API_TOKEN
```

If OpenNext will call Cal.com private endpoints, set the same token on the site worker and use
`src/lib/calcom-internal-client.ts` so requests are signed with:

`Authorization: Bearer <CALCOM_INTERNAL_API_TOKEN>`

Optional (Stripe appointment deposits on self-hosted Cal.com):

```bash
wrangler secret put STRIPE_CLIENT_ID
wrangler secret put STRIPE_PRIVATE_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put NEXT_PUBLIC_STRIPE_PUBLIC_KEY
```

The container worker forwards any `STRIPE_*` and `NEXT_PUBLIC_STRIPE_*` secrets into the Cal.com runtime.

Optional (only if the Cal.com image needs explicit startup override):

```bash
wrangler secret put CALCOM_START_COMMAND
```

Optional booking anti-bot enforcement (Turnstile on booking-related POST APIs):

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

And set worker var in `wrangler.toml`:

```toml
CALCOM_BOOKING_TURNSTILE_REQUIRED = "true"
```

When enabled, public booking POST requests (for example `/api/book/*`, `/api/public/*`, `/api/availability/*`, `/api/trpc/*`) must include either:

- `cf-turnstile-response: <token>`
- `x-turnstile-token: <token>`

## Route isolation controls

The edge Worker can run in strict route-policy mode so only selected Cal.com routes are public.

Set these in `wrangler.toml` (plain vars, not secrets):

- `CALCOM_ROUTE_POLICY_ENABLED="true"`: enables allowlist enforcement.
- `CALCOM_PUBLIC_ROUTE_RULES="METHOD:/path,METHOD:/prefix/*,..."`: public route list.
  - Example: `GET:/,GET:/book/*,GET:/booking/*,GET:/event/*,GET:/_next/*,GET:/api/book/*,POST:/api/book/*,GET:/api/bookings/*,POST:/api/bookings/*,GET:/api/public/*,POST:/api/public/*,GET:/api/availability/*,POST:/api/availability/*,GET:/api/trpc/*,POST:/api/trpc/*,GET:/api/integrations/stripepayment/*,POST:/api/integrations/stripepayment/*,POST:/api/stripe/webhook,POST:/integrations/brevo/sms`
- Private routes require one of:
  - `Authorization: Bearer <CALCOM_INTERNAL_API_TOKEN>`
  - `x-calcom-internal-token: <CALCOM_INTERNAL_API_TOKEN>`

Internal signed requests bypass booking Turnstile checks.

If `CALCOM_ROUTE_POLICY_ENABLED` is not set to `true`, the Worker keeps legacy behavior and proxies all routes.

If you expose Cal.com admin UI routes publicly, protect them with Cloudflare Access route apps (for example `cal.genfix.com.au/admin*` and `cal.genfix.com.au/apps/admin*`).
You can provision these with:

```bash
pnpm cf:access:admin:provision -- --site-host genfix.com.au --cal-host cal.genfix.com.au --allow-emails editor@example.com
```

## Notes on Brevo

- Email: Worker injects Brevo SMTP settings into Cal.com (`smtp-relay.brevo.com`, username `apikey`, password `BREVO_API_KEY`).
- SMS: `POST /integrations/brevo/sms` is exposed by the container proxy and sends transactional SMS through Brevo.
- SMS auth: use `Authorization: Bearer <BREVO_SMS_WEBHOOK_TOKEN>` and JSON payload like `{ "to": "+614XXXXXXXX", "message": "Reminder: ..." }`.
- Cal.com reminder integration: create a Cal.com Workflow webhook action that calls `https://<your-worker-domain>/integrations/brevo/sms`.

## Manual Operations

The Worker exposes manual ops endpoints protected by `CALCOM_ADMIN_TRIGGER_TOKEN`:

- `POST /_ops/wake`
- `POST /_ops/backup`

Example:

```bash
curl -X POST "https://<your-worker-domain>/_ops/backup" \
  -H "Authorization: Bearer <CALCOM_ADMIN_TRIGGER_TOKEN>"
```

## Backup Behavior

Daily backup trigger runs `pg_dump`, compresses output, and uploads to:

`r2://$R2_BUCKET/$R2_BACKUP_PREFIX/<db>-<timestamp>.sql.gz`

with `STANDARD_IA` class.
