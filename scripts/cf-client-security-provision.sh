#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/cf-client-security-provision.sh <client-slug> <public-hostname> [internal-zone]

Examples:
  scripts/cf-client-security-provision.sh client1 client1.example.com internal.example.com
  scripts/cf-client-security-provision.sh acme acme.example.com

Required environment:
  CLOUDFLARE_API_TOKEN     Cloudflare API token with Access + Firewall edit scope

Optional environment:
  CLOUDFLARE_ACCOUNT_ID    Auto-resolved via `wrangler whoami` when omitted
  CLOUDFLARE_ZONE_ID       Zone ID for public-hostname (auto-resolved when omitted)
  CLOUDFLARE_ZONE_NAME     Apex zone (used for zone lookup when CLOUDFLARE_ZONE_ID omitted)
  ACCESS_ALLOW_EMAILS      Comma-separated email allowlist for Cloudflare Access
  ACCESS_ALLOW_DOMAINS     Comma-separated domain allowlist for Cloudflare Access
  STRIPE_IP_CIDRS          Comma-separated Stripe CIDRs for /api/stripe/webhook allowlist
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

for cmd in curl jq wrangler; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 1
  fi
done

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN is required" >&2
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

admin_host="admin-${client_slug}.${internal_zone}"
api_host="api-${client_slug}.${internal_zone}"
cal_host="cal-${client_slug}.${internal_zone}"
schedule_host="schedule.${public_host}"

client_prefix="GenFix client:${client_slug}"
access_policy_name="${client_prefix} allowlist"

cf_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl --silent --show-error --fail-with-body \
      -X "$method" \
      "https://api.cloudflare.com/client/v4${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$data"
    return
  fi

  curl --silent --show-error --fail-with-body \
    -X "$method" \
    "https://api.cloudflare.com/client/v4${path}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json"
}

derive_zone_name() {
  local host="$1"
  local fields
  fields=$(awk -F. '{print NF}' <<<"$host")
  if [[ "$fields" -lt 2 ]]; then
    echo "$host"
    return
  fi
  awk -F. '{print $(NF-1)"."$NF}' <<<"$host"
}

resolve_account_id() {
  if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    echo "$CLOUDFLARE_ACCOUNT_ID"
    return
  fi

  local account_id
  account_id=$(wrangler whoami --json 2>/dev/null | jq -r '.accounts[0].id // empty')
  if [[ -z "$account_id" ]]; then
    account_id=$(wrangler whoami --format json 2>/dev/null | jq -r '.accounts[0].id // empty')
  fi

  if [[ -z "$account_id" ]]; then
    echo "Error: could not resolve CLOUDFLARE_ACCOUNT_ID automatically. Set CLOUDFLARE_ACCOUNT_ID." >&2
    exit 1
  fi

  echo "$account_id"
}

resolve_zone_id() {
  if [[ -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
    echo "$CLOUDFLARE_ZONE_ID"
    return
  fi

  local zone_name="${CLOUDFLARE_ZONE_NAME:-}"
  if [[ -z "$zone_name" ]]; then
    zone_name=$(derive_zone_name "$public_host")
  fi

  local response
  response=$(cf_api GET "/zones?name=${zone_name}&per_page=1")

  local zone_id
  zone_id=$(jq -r '.result[0].id // empty' <<<"$response")
  if [[ -z "$zone_id" ]]; then
    echo "Error: failed to resolve zone id for zone '${zone_name}'. Set CLOUDFLARE_ZONE_ID." >&2
    exit 1
  fi

  echo "$zone_id"
}

build_access_include_json() {
  jq -cn \
    --arg emails "${ACCESS_ALLOW_EMAILS:-}" \
    --arg domains "${ACCESS_ALLOW_DOMAINS:-}" '
      def csv($v): ($v // "") | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0));
      (csv($emails) | map({email: {email: .}})) +
      (csv($domains) | map({email_domain: {domain: (sub("^@"; "") | ascii_downcase)}}))
    '
}

access_include_json=$(build_access_include_json)
if [[ "$access_include_json" == "[]" ]]; then
  echo "Error: Access allowlist is empty. Set ACCESS_ALLOW_EMAILS and/or ACCESS_ALLOW_DOMAINS." >&2
  exit 1
fi

account_id="$(resolve_account_id)"
zone_id="$(resolve_zone_id)"

echo "Using account_id=${account_id} zone_id=${zone_id}"

delete_existing_access_policies() {
  local app_id="$1"
  local policies_json
  policies_json=$(cf_api GET "/accounts/${account_id}/access/apps/${app_id}/policies?per_page=1000")

  mapfile -t policy_ids < <(jq -r --arg name "$access_policy_name" '.result[] | select(.name == $name) | .id' <<<"$policies_json")
  for policy_id in "${policy_ids[@]}"; do
    cf_api DELETE "/accounts/${account_id}/access/apps/${app_id}/policies/${policy_id}" >/dev/null
  done
}

upsert_access_app() {
  local domain="$1"
  local app_name="$2"

  local apps_json
  apps_json=$(cf_api GET "/accounts/${account_id}/access/apps?per_page=1000")

  local app_id
  app_id=$(jq -r --arg domain "$domain" '.result[] | select(.domain == $domain) | .id' <<<"$apps_json" | head -n1)

  local payload
  payload=$(jq -cn \
    --arg name "$app_name" \
    --arg domain "$domain" \
    '{
      name: $name,
      domain: $domain,
      type: "self_hosted",
      app_launcher_visible: false,
      auto_redirect_to_identity: true,
      session_duration: "24h"
    }')

  local response
  if [[ -n "$app_id" ]]; then
    response=$(cf_api PUT "/accounts/${account_id}/access/apps/${app_id}" "$payload")
  else
    response=$(cf_api POST "/accounts/${account_id}/access/apps" "$payload")
    app_id=$(jq -r '.result.id // empty' <<<"$response")
  fi

  if [[ -z "$app_id" ]]; then
    app_id=$(jq -r '.result.id // empty' <<<"$response")
  fi

  if [[ -z "$app_id" ]]; then
    echo "Error: unable to upsert access app for ${domain}" >&2
    exit 1
  fi

  delete_existing_access_policies "$app_id"

  local policy_payload
  policy_payload=$(jq -cn \
    --arg name "$access_policy_name" \
    --argjson include "$access_include_json" \
    '{
      name: $name,
      decision: "allow",
      include: $include,
      require: [],
      exclude: []
    }')

  cf_api POST "/accounts/${account_id}/access/apps/${app_id}/policies" "$policy_payload" >/dev/null

  echo "Access app ready: ${domain}"
}

cleanup_firewall_objects() {
  local rules_json
  rules_json=$(cf_api GET "/zones/${zone_id}/firewall/rules?per_page=1000")
  mapfile -t rule_ids < <(jq -r --arg prefix "$client_prefix" '.result[] | select((.description // "") | startswith($prefix)) | .id' <<<"$rules_json")
  for rule_id in "${rule_ids[@]}"; do
    cf_api DELETE "/zones/${zone_id}/firewall/rules/${rule_id}" >/dev/null
  done

  local filters_json
  filters_json=$(cf_api GET "/zones/${zone_id}/filters?per_page=1000")
  mapfile -t filter_ids < <(jq -r --arg prefix "$client_prefix" '.result[] | select((.description // "") | startswith($prefix)) | .id' <<<"$filters_json")
  for filter_id in "${filter_ids[@]}"; do
    cf_api DELETE "/zones/${zone_id}/filters/${filter_id}" >/dev/null
  done
}

create_firewall_rule() {
  local description="$1"
  local expression="$2"
  local action="$3"

  local filter_payload
  filter_payload=$(jq -cn --arg desc "$description" --arg expr "$expression" '[{description: $desc, expression: $expr}]')

  local filter_response
  filter_response=$(cf_api POST "/zones/${zone_id}/filters" "$filter_payload")

  local filter_id
  filter_id=$(jq -r '.result[0].id // empty' <<<"$filter_response")
  if [[ -z "$filter_id" ]]; then
    echo "Error: failed to create firewall filter '${description}'" >&2
    exit 1
  fi

  local rule_payload
  rule_payload=$(jq -cn \
    --arg id "$filter_id" \
    --arg action "$action" \
    --arg desc "$description" \
    '[{filter: {id: $id}, action: $action, description: $desc}]')

  cf_api POST "/zones/${zone_id}/firewall/rules" "$rule_payload" >/dev/null
  echo "Firewall rule created: ${description}"
}

build_stripe_ip_set() {
  local raw="${STRIPE_IP_CIDRS:-}"
  if [[ -z "$raw" ]]; then
    echo ""
    return
  fi

  awk -F, '{
    for (i = 1; i <= NF; i++) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
      if (length($i) > 0) {
        printf "%s%s", (count++ ? " " : ""), $i
      }
    }
  }' <<<"$raw"
}

ops_expr="(http.host eq \"${public_host}\" and starts_with(http.request.uri.path, \"/_ops/\"))"
stripe_method_expr="(http.host eq \"${public_host}\" and http.request.uri.path eq \"/api/stripe/webhook\" and http.request.method ne \"POST\")"
calcom_private_expr="(http.host eq \"${schedule_host}\" and not (http.request.uri.path eq \"/\" or starts_with(http.request.uri.path, \"/book/\") or starts_with(http.request.uri.path, \"/booking/\") or starts_with(http.request.uri.path, \"/event/\") or starts_with(http.request.uri.path, \"/embed/\") or starts_with(http.request.uri.path, \"/_next/\") or starts_with(http.request.uri.path, \"/static/\") or starts_with(http.request.uri.path, \"/api/book/\") or starts_with(http.request.uri.path, \"/api/bookings/\") or starts_with(http.request.uri.path, \"/api/public/\") or starts_with(http.request.uri.path, \"/api/availability/\") or starts_with(http.request.uri.path, \"/api/trpc/\") or starts_with(http.request.uri.path, \"/api/integrations/stripepayment/\") or http.request.uri.path eq \"/api/stripe/webhook\" or http.request.uri.path eq \"/integrations/brevo/sms\"))"

stripe_ip_set="$(build_stripe_ip_set)"

cleanup_firewall_objects

create_firewall_rule "${client_prefix} block _ops paths" "$ops_expr" "block"
create_firewall_rule "${client_prefix} enforce stripe webhook POST" "$stripe_method_expr" "block"

if [[ -n "$stripe_ip_set" ]]; then
  stripe_ip_expr="(http.host eq \"${public_host}\" and http.request.uri.path eq \"/api/stripe/webhook\" and not ip.src in { ${stripe_ip_set} })"
  create_firewall_rule "${client_prefix} enforce stripe webhook IP allowlist" "$stripe_ip_expr" "block"
else
  echo "Warning: STRIPE_IP_CIDRS is empty; Stripe webhook IP allowlist rule was skipped."
fi

create_firewall_rule "${client_prefix} block Cal.com private paths" "$calcom_private_expr" "block"

upsert_access_app "$admin_host" "${client_prefix} Tina Admin"
upsert_access_app "$api_host" "${client_prefix} Internal API"
upsert_access_app "$cal_host" "${client_prefix} Cal.com Internal"

echo "Done: Access policies and WAF rules are provisioned for ${client_slug}."
