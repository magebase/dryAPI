#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/cf-client-init.sh <client-slug> <public-hostname> [internal-zone]

Examples:
  scripts/cf-client-init.sh client1 client1.example.com internal.example.com
  scripts/cf-client-init.sh acme acme.example.com

Arguments:
  client-slug      Lowercase slug used in worker/resource names (letters, numbers, hyphens)
  public-hostname  Public frontend host for this client (for example: client1.example.com)
  internal-zone    Internal DNS zone for private hostnames (default: internal.example.com)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
  exit 1
fi

client_slug="$1"
public_host="$2"
internal_zone="${3:-internal.example.com}"

if [[ ! "$client_slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Error: client-slug must match ^[a-z0-9][a-z0-9-]*$" >&2
  exit 1
fi

if [[ ! "$public_host" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Error: public-hostname must be a valid hostname" >&2
  exit 1
fi

if [[ ! "$internal_zone" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Error: internal-zone must be a valid hostname" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
client_dir="${repo_root}/cloudflare/clients/${client_slug}"

if [[ -e "$client_dir" ]]; then
  echo "Error: ${client_dir} already exists" >&2
  exit 1
fi

mkdir -p "$client_dir"

site_worker="genfix-${client_slug}-site"
calcom_worker="genfix-${client_slug}-calcom"
d1_name="genfix-${client_slug}-d1"
kv_name="genfix-${client_slug}-kv"
r2_cache_bucket="genfix-${client_slug}-next-cache"
r2_media_bucket="genfix-${client_slug}-media"
r2_backup_bucket="genfix-${client_slug}-calcom-backups"

backend_host="api-${client_slug}.${internal_zone}"
calcom_internal_host="cal-${client_slug}.${internal_zone}"
admin_host="admin-${client_slug}.${internal_zone}"

cat > "${client_dir}/wrangler.site.jsonc" <<EOF
{
  "\$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "${site_worker}",
  "main": "../../.open-next/worker.js",
  "compatibility_date": "2026-03-11",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": "../../.open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "${site_worker}"
    },
    {
      "binding": "CALCOM_EDGE",
      "service": "${calcom_worker}"
    }
  ],
  "r2_buckets": [
    {
      "binding": "NEXT_INC_CACHE_R2_BUCKET",
      "bucket_name": "${r2_cache_bucket}"
    },
    {
      "binding": "SITE_MEDIA",
      "bucket_name": "${r2_media_bucket}"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "APP_KV",
      "id": "<replace-with-kv-namespace-id>"
    }
  ],
  "d1_databases": [
    {
      "binding": "QUOTE_DB",
      "database_name": "${d1_name}",
      "database_id": "<replace-with-d1-database-id>",
      "migrations_dir": "../../drizzle/migrations"
    }
  ],
  "vars": {
    "CALCOM_INTERNAL_BASE_URL": "https://schedule.${public_host}",
    "NEXT_PUBLIC_PLAN_TIER": "basic",
    "NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID": ""
  },
  "images": {
    "binding": "IMAGES"
  }
}
EOF

cat > "${client_dir}/wrangler.calcom.toml" <<EOF
name = "${calcom_worker}"
main = "../../container/src/worker.ts"
compatibility_date = "2026-03-11"
workers_dev = true

# Add routes here when ready, for example:
# routes = [
#   { pattern = "schedule.${public_host}/*", zone_name = "example.com" }
# ]

[triggers]
crons = ["0 * * * *", "15 2 * * *"]

[[containers]]
class_name = "CalcomContainer"
image = "../../container/Dockerfile"
instance_type = "standard-1"
max_instances = 1

[[durable_objects.bindings]]
name = "CALCOM_CONTAINER"
class_name = "CalcomContainer"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["CalcomContainer"]

[vars]
CALCOM_BACKUP_PREFIX = "${client_slug}/calcom/postgres"
CALCOM_ROUTE_POLICY_ENABLED = "true"
CALCOM_PUBLIC_ROUTE_RULES = "GET:/,GET:/book/*,GET:/booking/*,GET:/event/*,GET:/embed/*,GET:/_next/*,GET:/static/*,GET:/api/public/*,POST:/api/public/*,GET:/api/availability/*,POST:/api/availability/*,GET:/api/integrations/stripepayment/*,POST:/api/integrations/stripepayment/*,POST:/api/stripe/webhook,POST:/integrations/brevo/sms"
EOF

cat > "${client_dir}/provision.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

# Run from repository root.

CLIENT_SLUG="${client_slug}"
PUBLIC_HOST="${public_host}"
INTERNAL_ZONE="${internal_zone}"

SITE_WORKER="${site_worker}"
CALCOM_WORKER="${calcom_worker}"
D1_NAME="${d1_name}"
KV_NAME="${kv_name}"
R2_CACHE_BUCKET="${r2_cache_bucket}"
R2_MEDIA_BUCKET="${r2_media_bucket}"
R2_BACKUP_BUCKET="${r2_backup_bucket}"

BACKEND_HOST="${backend_host}"
CALCOM_INTERNAL_HOST="${calcom_internal_host}"
ADMIN_HOST="${admin_host}"

# 1) Per-client data plane resources.
wrangler d1 create "\${D1_NAME}"
wrangler kv namespace create "\${KV_NAME}"
wrangler r2 bucket create "\${R2_CACHE_BUCKET}"
wrangler r2 bucket create "\${R2_MEDIA_BUCKET}"
wrangler r2 bucket create "\${R2_BACKUP_BUCKET}"

# 2) Build OpenNext output for deploy.
pnpm run cf:build

# 3) Deploy isolated site and Cal.com workers for this client.
wrangler deploy --config "cloudflare/clients/${client_slug}/wrangler.site.jsonc"
wrangler deploy --config "cloudflare/clients/${client_slug}/wrangler.calcom.toml"

# 3.1) Set signed internal-call secret on OpenNext site worker.
echo "Setting secret for \${SITE_WORKER}: CALCOM_INTERNAL_API_TOKEN"
wrangler secret put "CALCOM_INTERNAL_API_TOKEN" --config "cloudflare/clients/${client_slug}/wrangler.site.jsonc"

# 3.2) Set Brevo secrets on site worker for contact/quote email delivery.
for key in \
  BREVO_API_KEY \
  BREVO_FROM_EMAIL \
  BREVO_FROM_NAME
  do
  echo "Setting secret for \${SITE_WORKER}: \${key}"
  wrangler secret put "\${key}" --config "cloudflare/clients/${client_slug}/wrangler.site.jsonc"
done

# 4) Set required secrets for Cal.com container worker.
for key in \
  INTERNAL_CRON_TOKEN \
  CALCOM_ADMIN_TRIGGER_TOKEN \
  CALCOM_INTERNAL_API_TOKEN \
  POSTGRES_PASSWORD \
  BREVO_API_KEY \
  BREVO_FROM_EMAIL \
  BREVO_SMS_SENDER \
  BREVO_SMS_WEBHOOK_TOKEN \
  R2_ACCESS_KEY_ID \
  R2_SECRET_ACCESS_KEY \
  R2_BUCKET \
  R2_ENDPOINT \
  CALCOM_BASE_URL \
  CALCOM_NEXTAUTH_SECRET \
  CALCOM_ENCRYPTION_KEY
  do
  echo "Setting secret for \${CALCOM_WORKER}: \${key}"
  wrangler secret put "\${key}" --config "cloudflare/clients/${client_slug}/wrangler.calcom.toml"
done

if [[ "\${ENABLE_CALCOM_STRIPE_DEPOSITS:-0}" == "1" ]]; then
  for key in \
    STRIPE_CLIENT_ID \
    STRIPE_PRIVATE_KEY \
    STRIPE_WEBHOOK_SECRET \
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY
    do
    echo "Setting Stripe deposit secret for \${CALCOM_WORKER}: \${key}"
    wrangler secret put "\${key}" --config "cloudflare/clients/${client_slug}/wrangler.calcom.toml"
  done
else
  echo "Skipping Stripe deposit secrets (set ENABLE_CALCOM_STRIPE_DEPOSITS=1 to configure)."
fi

# 5) Optional: provision Cloudflare Access + WAF policy bundle via API.
if [[ "${APPLY_CF_SECURITY:-0}" == "1" ]]; then
  echo "Applying automated Cloudflare Access/WAF bundle for \${CLIENT_SLUG}"
  bash scripts/cf-client-security-provision.sh "\${CLIENT_SLUG}" "\${PUBLIC_HOST}" "\${INTERNAL_ZONE}"
else
  echo "Skipping Access/WAF automation (set APPLY_CF_SECURITY=1 to enable)."
fi

cat <<GUIDE

Next manual steps:
1. Update cloudflare/clients/${client_slug}/wrangler.site.jsonc with real D1/KV IDs from command output.
2. Create DNS records:
   - ${public_host} -> ${site_worker}
   - schedule.${public_host} -> ${calcom_worker} (if public scheduler is required)
   - ${backend_host}, ${calcom_internal_host}, ${admin_host} as private/internal routes via tunnel.
3. Ensure CALCOM_INTERNAL_API_TOKEN is set to the same value on both workers:
  - ${site_worker}
  - ${calcom_worker}
4. Run API-driven security bundle (recommended):
  APPLY_CF_SECURITY=1 \
  ACCESS_ALLOW_EMAILS="admin@example.com" \
  STRIPE_IP_CIDRS="3.18.12.63/32,3.130.192.231/32" \
  cloudflare/clients/${client_slug}/provision.sh
5. Optional: configure Stripe appointment deposits on Cal.com worker:
  ENABLE_CALCOM_STRIPE_DEPOSITS=1 \
  cloudflare/clients/${client_slug}/provision.sh

GUIDE
EOF

chmod +x "${client_dir}/provision.sh"

cat > "${client_dir}/topology.md" <<EOF
# ${client_slug} Cloudflare topology

Public endpoints:
- https://${public_host} (OpenNext frontend)
- Optional: https://schedule.${public_host} (Cal.com public scheduling routes only)
- Stripe webhook: https://${public_host}/api/stripe/webhook

Private endpoints:
- https://${backend_host}
- https://${calcom_internal_host}
- https://${admin_host}

Internal resource names:
- D1: ${d1_name}
- KV: ${kv_name}
- R2 cache: ${r2_cache_bucket}
- R2 media: ${r2_media_bucket}
- R2 backups: ${r2_backup_bucket}

Traffic policy defaults:
- Default deny private hostnames with Cloudflare Access.
- Allow only specific public Cal.com routes in CALCOM_PUBLIC_ROUTE_RULES.
- Require CALCOM_INTERNAL_API_TOKEN for private Cal.com routes.
- Keep D1, KV, and R2 reachable only through worker bindings.

Automation:
- API-driven bundle: scripts/cf-client-security-provision.sh
- This bundle can upsert Access applications/policies and WAF rules for this client.
EOF

cat > "${client_dir}/security.auto.env.example" <<EOF
# Required for scripts/cf-client-security-provision.sh
CLOUDFLARE_API_TOKEN=

# Optional (auto-resolved via wrangler when omitted)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_ZONE_NAME=

# Access allowlist (set at least one)
ACCESS_ALLOW_EMAILS=admin@example.com
ACCESS_ALLOW_DOMAINS=example.com

# Optional Stripe source IP allowlist (comma-separated CIDRs)
STRIPE_IP_CIDRS=
EOF

cat > "${client_dir}/service-packages.json" <<EOF
{
  "tiers": [
    {
      "id": "basic",
      "targetSetupWindowHours": "3-4",
      "includes": [
        "Marketing site (3 pages)",
        "Cal.com self-hosted booking",
        "AI FAQ chat widget"
      ],
      "analytics": {
        "microsoftClarity": false
      }
    },
    {
      "id": "growth",
      "targetSetupWindowHours": "4-6",
      "includes": [
        "Marketing site (3-5 pages)",
        "Cal.com booking + reminders",
        "Brevo email/SMS follow-ups",
        "Cloudflare Workflow lead and review automations"
      ],
      "analytics": {
        "microsoftClarity": true
      }
    },
    {
      "id": "pro",
      "targetSetupWindowHours": "6-8",
      "includes": [
        "Everything in Growth",
        "Pro automation workflow pack",
        "CRM sync (HubSpot/Salesforce/Zoho)",
        "KPI dashboard logging"
      ],
      "analytics": {
        "microsoftClarity": true
      }
    }
  ],
  "emailAndSms": {
    "provider": "brevo",
    "reactEmailTemplates": true
  },
  "crmOptions": ["hubspot", "salesforce", "zoho"],
  "addOns": [
    {
      "id": "extra-pages",
      "label": "Extra pages",
      "priceMonthly": 20,
      "unit": "per page"
    },
    {
      "id": "seo-optimization-manual",
      "label": "SEO optimization (manual)",
      "priceMonthly": 99,
      "note": "Developer-run process; edits made later by the client can affect outcomes"
    },
    {
      "id": "ai-autoblogger",
      "label": "AI powered autoblogger",
      "priceMonthly": 49,
      "model": "gemini-3-flash"
    },
    {
      "id": "advanced-ai-chatbot",
      "label": "Advanced AI chatbot",
      "priceMonthly": 79,
      "platform": "cloudflare-ai-search",
      "billing": "overage"
    }
  ]
}
EOF

cat > "${client_dir}/cloudflare-workflow-catalog.json" <<EOF
{
  "engine": "cloudflare-workflows",
  "dispatchEndpoint": "/automation/dispatch",
  "implementedFlowKinds": [
    "lead-scoring-and-tagging",
    "multi-channel-follow-up-sequencer",
    "upsell-cross-sell-suggestions",
    "review-aggregation-and-posting",
    "payment-deposit-follow-up",
    "lost-lead-recovery",
    "event-webinar-reminders",
    "vip-high-value-lead-alerts",
    "abandoned-form-recovery",
    "loyalty-repeat-client-automation",
    "geo-targeted-promotions",
    "internal-kpi-dashboard-sync"
  ],
  "coreWorkflows": [
    {
      "id": "lead-scoring-and-tagging",
      "trigger": "Form submission or AI chat lead capture",
      "actions": [
        "Score lead by urgency/location/service",
        "Tag and prioritize in CRM",
        "Notify owner on high-priority leads"
      ],
      "value": "No missed leads"
    },
    {
      "id": "event-webinar-reminders",
      "trigger": "Booking, webinar, or consultation confirmed",
      "actions": [
        "Send confirmation + reminder sequence",
        "Send calendar and attendance nudges",
        "Send follow-up survey"
      ],
      "value": "Lower no-show rate"
    },
    {
      "id": "review-aggregation-and-posting",
      "trigger": "Booking marked complete",
      "actions": [
        "Collect and route review responses",
        "Push to reputation channels/dashboard",
        "Alert team in Slack"
      ],
      "value": "More public reviews"
    },
    {
      "id": "multi-channel-follow-up-sequencer",
      "trigger": "Lead has not booked within 48h",
      "actions": [
        "Run timed email + SMS + optional WhatsApp/Telegram sequence",
        "Escalate to CRM when no response"
      ],
      "value": "Recover warm opportunities"
    },
    {
      "id": "internal-kpi-dashboard-sync",
      "trigger": "Any lead/booking activity",
      "actions": [
        "Push KPI snapshot to dashboard/sheets",
        "Keep conversion metrics live"
      ],
      "value": "Real-time team visibility"
    }
  ],
  "proOnlyTemplates": [
    {
      "id": "lead-scoring-and-tagging",
      "trigger": "New lead from form or AI chat",
      "value": "Prioritizes high-quality leads automatically"
    },
    {
      "id": "multi-channel-follow-up-sequencer",
      "trigger": "Lead has not booked in 24-48h",
      "value": "Automated drip increases conversion without manual work"
    },
    {
      "id": "upsell-cross-sell-suggestions",
      "trigger": "Lead books a service",
      "value": "Boosts revenue per client automatically"
    },
    {
      "id": "review-aggregation-and-posting",
      "trigger": "Service marked complete",
      "value": "Builds reputation without manual chasing"
    },
    {
      "id": "payment-deposit-follow-up",
      "trigger": "Booking created and deposit still pending",
      "value": "Reduces no-shows and protects revenue"
    },
    {
      "id": "lost-lead-recovery",
      "trigger": "Lead did not book after delay window",
      "value": "Recaptures potentially lost revenue"
    },
    {
      "id": "event-webinar-reminders",
      "trigger": "Lead signed up for webinar or consultation",
      "value": "Increases attendance and engagement"
    },
    {
      "id": "vip-high-value-lead-alerts",
      "trigger": "Lead matches high-value criteria",
      "value": "Ensures immediate attention on big-opportunity leads"
    },
    {
      "id": "abandoned-form-recovery",
      "trigger": "Lead starts but does not submit a form",
      "value": "Converts leads who almost slipped through"
    },
    {
      "id": "loyalty-repeat-client-automation",
      "trigger": "Repeat booking or elapsed time since service",
      "value": "Drives repeat revenue automatically"
    },
    {
      "id": "geo-targeted-promotions",
      "trigger": "Lead in targeted location",
      "value": "Personalized promotions without extra manual effort"
    },
    {
      "id": "internal-kpi-dashboard-sync",
      "trigger": "Any tracked funnel activity",
      "value": "Live visibility into lead and revenue metrics"
    }
  ],
  "crmOptions": ["hubspot", "salesforce", "zoho"]
}
EOF

cat > "${client_dir}/automation.env.example" <<EOF
# Tier defaults
NEXT_PUBLIC_PLAN_TIER=pro
NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID=

# CRM provider (top-3 marketshare options)
CRM_PROVIDER=hubspot
HUBSPOT_PRIVATE_APP_TOKEN=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=
SALESFORCE_SECURITY_TOKEN=
SALESFORCE_LOGIN_URL=https://login.salesforce.com
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORG_ID=

# Brevo unified outbound channel
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=${client_slug^} Ops
BREVO_SMS_SENDER=
BREVO_SMS_WEBHOOK_TOKEN=

# Add-on: AI autoblogger
AUTOBLOGGER_MODEL=gemini-3-flash
GEMINI_API_KEY=

# Add-on: Advanced AI chatbot (Cloudflare AI Search)
CLOUDFLARE_AI_SEARCH_ACCOUNT_ID=
CLOUDFLARE_AI_SEARCH_API_TOKEN=
CLOUDFLARE_AI_SEARCH_INDEX=
EOF

echo "Created per-client scaffold in: ${client_dir}"
echo "Next: review ${client_dir}/wrangler.site.jsonc and run ${client_dir}/provision.sh"
