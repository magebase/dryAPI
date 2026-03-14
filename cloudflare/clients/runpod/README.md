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
node scripts/build-runpod-image-endpoints.mjs
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
