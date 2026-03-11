# Cloudflare Automation Workflows

This package runs automation flows on Cloudflare Workflows.

## What it does

- Defines a durable `AutomationWorkflow` class that runs automation jobs as steps.
- Exposes API endpoints to trigger workflow instances from app routes and services.
- Supports cron-driven dispatch of configured workflow kinds.
- Uses Brevo and optional webhook targets for outbound actions.

## Install and Deploy

```bash
pnpm --dir cloudflare/workflows install
pnpm --dir cloudflare/workflows deploy
```

## Endpoints

- `POST /automation/dispatch`
  - Body: `{ "kind": "chat-escalation", "payload": { ... } }`
  - Triggers a new workflow instance.
- `GET /automation/instances/:id`
  - Returns instance status.
- `GET /automation/kinds`
  - Returns all supported workflow kinds.

Authentication:

- Set `AUTOMATION_API_TOKEN` and send `Authorization: Bearer <token>`.
- For scheduled flows, set `AUTOMATION_SCHEDULED_FLOWS` as comma-separated kinds.

## Supported flow kinds

- `chat-escalation`
- `lead-scoring-and-tagging`
- `multi-channel-follow-up-sequencer`
- `upsell-cross-sell-suggestions`
- `review-aggregation-and-posting`
- `payment-deposit-follow-up`
- `lost-lead-recovery`
- `event-webinar-reminders`
- `vip-high-value-lead-alerts`
- `abandoned-form-recovery`
- `loyalty-repeat-client-automation`
- `geo-targeted-promotions`
- `internal-kpi-dashboard-sync`

Legacy aliases accepted for backwards compatibility:

- `new-lead` -> `lead-scoring-and-tagging`
- `booking-confirmation-reminders` -> `event-webinar-reminders`
- `review-reputation` -> `review-aggregation-and-posting`
- `lead-nurture` -> `multi-channel-follow-up-sequencer`
- `team-notifications` -> `vip-high-value-lead-alerts`
- `review-aggregation-and-alerting` -> `review-aggregation-and-posting`

## Optional secrets

```bash
cd cloudflare/workflows
wrangler secret put AUTOMATION_API_TOKEN
wrangler secret put BREVO_API_KEY
wrangler secret put BREVO_FROM_EMAIL
wrangler secret put BREVO_FROM_NAME
wrangler secret put BREVO_SMS_SENDER
wrangler secret put BREVO_ESCALATION_SMS_TO
wrangler secret put CHAT_ESCALATION_EMAIL_TO
wrangler secret put CRM_WEBHOOK_URL
wrangler secret put TEAM_NOTIFICATIONS_WEBHOOK_URL
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put KPI_WEBHOOK_URL
wrangler secret put REVIEW_AGGREGATION_WEBHOOK_URL
wrangler secret put PAYMENT_STATUS_WEBHOOK_URL
wrangler secret put RETARGETING_WEBHOOK_URL
wrangler secret put GEO_PROMOTIONS_WEBHOOK_URL
wrangler secret put WHATSAPP_WEBHOOK_URL
wrangler secret put WHATSAPP_WEBHOOK_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_URL
wrangler secret put TELEGRAM_WEBHOOK_TOKEN
```
