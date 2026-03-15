# RunPod Image Endpoint Build

This directory contains a pinned, reproducible mapping of deAPI image-capable model slugs to open-source model sources, plus generated RunPod endpoint specs.

## Files

- `image-model-catalog.json`
  - Source of truth for model slug -> open-source `imageTag` mapping.
  - Pins each model to a concrete repo + revision + artifact.
- `runpod-image-endpoints.manifest.json`
  - Generated endpoint specs for RunPod serverless provisioning.
- `runpod-image-endpoints.env.example`
  - Required env vars for template IDs and API key wiring.
- `runpod-image-endpoints.create-requests.json`
  - Endpoint creation request templates (one object per model) with env payloads.

## Build Endpoint Manifest

From repo root:

```bash
node scripts/optimize-runpod-gpu-revenue.mjs --write
node scripts/build-runpod-image-endpoints.mjs
```

The optimizer enforces for every model:

- At least 3 GPU fallback types.
- GPU fallback ordering by cost-efficiency (best first) for each worker class.
- A minimum CUDA version constraint shared by catalog and generated endpoint payloads.

## Apply Endpoints with Pulumi (Destroy First)

RunPod endpoint provisioning is managed via Pulumi under `cloudflare/clients/runpod/pulumi`.

Use the repo-level redeploy command to enforce this order:

1. Destroy existing managed endpoints.
2. Rebuild manifests from the latest catalog.
3. Recreate endpoints with Pulumi.

```bash
bash scripts/runpod-endpoints-pulumi-redeploy.sh dev
```

Equivalent package script:

```bash
pnpm run runpod:endpoints:image:redeploy -- dev
```

Pulumi state backend requirement:

- The redeploy script enforces an R2 S3 backend and logs in before any stack action.
- Provide either:
  - `RUNPOD_PULUMI_BACKEND_URL=s3://<bucket>?endpoint=https://<account-id>.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true`
  - or both `RUNPOD_PULUMI_STATE_BUCKET` and `CLOUDFLARE_ACCOUNT_ID`
- Also export R2 credentials for backend access:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

Pulumi config requirement:

```bash
cd cloudflare/clients/runpod/pulumi
pulumi config set --secret runpod:token <YOUR_RUNPOD_API_KEY>
```

Optional flags:

```bash
node scripts/build-runpod-image-endpoints.mjs \
  --catalog cloudflare/clients/runpod/image-model-catalog.json \
  --out cloudflare/clients/runpod/runpod-image-endpoints.manifest.json \
  --env-example-out cloudflare/clients/runpod/runpod-image-endpoints.env.example \
  --requests-out cloudflare/clients/runpod/runpod-image-endpoints.create-requests.json \
  --stdout
```

## What "imageTag" Means Here

Each model is normalized to a source tag string that can be used directly in endpoint env setup:

- Hugging Face models: `hf://<repo>@<revision>#<artifact>`
- GitHub release assets: `gh://<repo>@<release-tag>#<artifact>`

Example:

- `hf://black-forest-labs/FLUX.2-klein-4B@e7b7dc27f91deacad38e78976d1f2b499d76a294#flux-2-klein-4b.safetensors`

## Notes

- Some deAPI slugs include runtime quantization descriptors (e.g. `INT8`, `NF4`) where upstream open-source repos do not publish a separate artifact filename with that exact suffix.
- For those entries, the catalog pins the canonical upstream repo revision and records the quantization mode as a runtime worker concern.
