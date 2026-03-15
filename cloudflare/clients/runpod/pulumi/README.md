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

- R2 backend access credentials exported:

```bash
export AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
export AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
```

- R2 state backend location exported (either explicit URL, or bucket + account id):

```bash
# Option A: explicit backend URL
export RUNPOD_PULUMI_BACKEND_URL="s3://<bucket>?endpoint=https://<account-id>.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true"

# Option B: constructed by script
export RUNPOD_PULUMI_STATE_BUCKET=<bucket>
export CLOUDFLARE_ACCOUNT_ID=<account-id>
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

## Notes

- Endpoint fallback GPU ordering is read from manifest `runpod.gpuTypes`.
- Manifest-generated controls (`queueDelaySeconds`, `flashboot`, and min CUDA metadata) remain encoded in the build outputs and env contract.
