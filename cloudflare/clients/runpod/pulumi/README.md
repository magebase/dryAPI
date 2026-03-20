# RunPod Endpoints via Pulumi

This Pulumi project manages serverless RunPod endpoints from the generated manifest:

- `../runpod-image-endpoints.manifest.json`

Provider package:

- `@runpod-infra/pulumi`

## Prerequisites

- Pulumi CLI installed
- R2-backed Pulumi state backend (not Pulumi Cloud)
- RunPod API key configured for stack:

```bash
pulumi config set --secret runpod:token <YOUR_RUNPOD_API_KEY>
```

- Non-interactive Pulumi secret passphrase exported:

```bash
export PULUMI_CONFIG_PASSPHRASE=<strong-passphrase>
```

- R2 backend access credentials exported:

```bash
export CLOUDFLARE_OBJECT_STORAGE_ACCESS_KEY=<R2_ACCESS_KEY_ID>
export CLOUDFLARE_OBJECT_STORAGE_SECRET_KEY=<R2_SECRET_ACCESS_KEY>
```

- R2 state backend location exported (either explicit URL, or bucket + account id):

```bash
# Option A: explicit backend URL
export RUNPOD_PULUMI_BACKEND_URL="s3://<bucket>?endpoint=https://<account-id>.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true"

# Option B: constructed by script
export RUNPOD_PULUMI_STATE_BUCKET=<bucket>
export CLOUDFLARE_ACCOUNT_ID=<account-id>
```

When a state bucket is configured (explicitly or inferred from backend URL), the wrapper script creates/verifies it using Wrangler:

```bash
wrangler r2 bucket create <bucket>
```

- Endpoint template IDs exported in your shell (must match manifest `templateIdEnv` values):

```bash
export RUNPOD_TEMPLATE_ID_DIFFUSERS_IMAGE=...
export RUNPOD_TEMPLATE_ID_VLM_OCR=...
export RUNPOD_TEMPLATE_ID_LTX_VIDEO=...
export RUNPOD_TEMPLATE_ID_IMAGE_UPSCALE=...
export RUNPOD_TEMPLATE_ID_BACKGROUND_REMOVAL=...
```

## Deploy Flow (Destroy First)

From repo root, this script performs the required order:

1. `pulumi destroy` existing endpoints
2. optimize GPU revenue ordering
3. rebuild endpoint manifest
4. `pulumi up` to recreate endpoints

```bash
bash scripts/runpod-endpoints-pulumi-redeploy.sh dev
```

Optional environment variables:

- `RUNPOD_PULUMI_STACK` (default stack if no arg provided)
- `RUNPOD_API_KEY` (auto-seeded into `runpod:token` for the selected stack)
- `RUNPOD_NETWORK_VOLUME_ID` (optional, applied to all endpoints)
- `RUNPOD_PULUMI_BACKEND_URL` (explicit R2 backend URL)
- `RUNPOD_PULUMI_STATE_BUCKET` + `CLOUDFLARE_ACCOUNT_ID` (backend URL components)
- `CLOUDFLARE_OBJECT_STORAGE_ACCESS_KEY` / `CLOUDFLARE_OBJECT_STORAGE_SECRET_KEY` (R2 S3 API credentials)
- `RUNPOD_ENDPOINTS_WORKERS_MAX_OVERRIDE` (optional cap for `workersMax` across all endpoints, useful for account quota limits)
- `RUNPOD_ENDPOINT_PROFILE` (optional profile override: `serverless10` or `all`; default is `serverless10`)

Pulumi stack config option:

- `runpod-image-endpoints:endpointProfile=serverless10` (default) deploys 10 fixed endpoints:
- `acestep-1-5-turbo`, `bge-m3-int8`, `ben2`, `flux-2-klein-4b-bf16`, `ltx2-3-22b-dist-int8`
- `nanonets-ocr-s-f16`, `qwen3-tts-12hz-1-7b-customvoice`, `realesrgan-x4`, `whisperlargev3`
- `zimageturbo-int8`
- `runpod-image-endpoints:endpointProfile=all` deploys all endpoints from the manifest.

## Notes

- Endpoint fallback GPU ordering is read from manifest `runpod.gpuTypes`.
- Manifest-generated controls (`queueDelaySeconds`, `flashboot`, and min CUDA metadata) remain encoded in the build outputs and env contract.
