#!/usr/bin/env bash
set -euo pipefail

# Run this from cloudflare/container or pass directory as first argument.
cd "${1:-$(dirname "$0")/..}"

for key in \
  INTERNAL_CRON_TOKEN \
  CALCOM_ADMIN_TRIGGER_TOKEN \
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
  echo "Setting secret: ${key}"
  wrangler secret put "${key}"
done

if [[ "${INCLUDE_OPTIONAL:-0}" == "1" ]]; then
  for key in \
    CALCOM_INTERNAL_API_TOKEN \
    STRIPE_CLIENT_ID \
    STRIPE_PRIVATE_KEY \
    STRIPE_WEBHOOK_SECRET \
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY
    do
    echo "Setting optional secret: ${key}"
    wrangler secret put "${key}"
  done
fi
