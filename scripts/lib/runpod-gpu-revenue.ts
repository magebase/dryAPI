// @ts-nocheck
const DEFAULT_GPU_MARKET = [
  {
    gpuType: "NVIDIA L4",
    pricePerHourUsd: 0.45,
    minCudaVersion: "12.2",
    speedByWorkerClass: {
      "diffusers-image": 0.85,
      "vlm-ocr": 1.0,
      "ltx-video": 0.45,
      "image-upscale": 1.0,
      "background-removal": 1.0,
      "embeddings-text": 1.2,
      "tts-customvoice": 0.8,
    },
  },
  {
    gpuType: "NVIDIA RTX 4090",
    pricePerHourUsd: 0.79,
    minCudaVersion: "12.2",
    speedByWorkerClass: {
      "diffusers-image": 1.0,
      "vlm-ocr": 1.08,
      "ltx-video": 0.65,
      "image-upscale": 1.12,
      "background-removal": 1.12,
      "embeddings-text": 1.5,
      "tts-customvoice": 1.0,
    },
  },
  {
    gpuType: "NVIDIA A6000",
    pricePerHourUsd: 0.99,
    minCudaVersion: "12.2",
    speedByWorkerClass: {
      "diffusers-image": 1.08,
      "vlm-ocr": 1.1,
      "ltx-video": 0.72,
      "image-upscale": 1.15,
      "background-removal": 1.14,
      "embeddings-text": 1.45,
      "tts-customvoice": 1.02,
    },
  },
  {
    gpuType: "NVIDIA A100",
    pricePerHourUsd: 2.19,
    minCudaVersion: "12.2",
    speedByWorkerClass: {
      "diffusers-image": 1.6,
      "vlm-ocr": 1.45,
      "ltx-video": 1.2,
      "image-upscale": 1.38,
      "background-removal": 1.33,
      "embeddings-text": 2.2,
      "tts-customvoice": 1.6,
    },
  },
  {
    gpuType: "NVIDIA H100",
    pricePerHourUsd: 3.99,
    minCudaVersion: "12.4",
    speedByWorkerClass: {
      "diffusers-image": 2.3,
      "vlm-ocr": 1.9,
      "ltx-video": 1.9,
      "image-upscale": 1.7,
      "background-removal": 1.62,
      "embeddings-text": 3.2,
      "tts-customvoice": 2.4,
    },
  },
]

function parseVersion(versionText) {
  const normalized = String(versionText || "").trim()
  if (!normalized) {
    return null
  }

  const [majorText, minorText = "0"] = normalized.split(".")
  const major = Number.parseInt(majorText, 10)
  const minor = Number.parseInt(minorText, 10)

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return null
  }

  return { major, minor }
}

function compareVersions(leftText, rightText) {
  const left = parseVersion(leftText)
  const right = parseVersion(rightText)

  if (!left || !right) {
    return 0
  }

  if (left.major !== right.major) {
    return left.major - right.major
  }

  return left.minor - right.minor
}

function supportsCudaVersion(gpuMinCudaVersion, requiredCudaVersion) {
  return compareVersions(gpuMinCudaVersion, requiredCudaVersion) >= 0
}

function getSpeedFactor(gpu, workerClass) {
  const speed = gpu.speedByWorkerClass?.[workerClass]
  if (typeof speed === "number" && Number.isFinite(speed) && speed > 0) {
    return speed
  }

  return 1
}

function toGpuScore(gpu, workerClass) {
  const speedFactor = getSpeedFactor(gpu, workerClass)
  const pricePerHourUsd = gpu.pricePerHourUsd
  const costPerUnitThroughput = pricePerHourUsd / speedFactor
  const costEfficiency = speedFactor / pricePerHourUsd

  return {
    gpuType: gpu.gpuType,
    speedFactor,
    pricePerHourUsd,
    costPerUnitThroughput,
    costEfficiency,
    minCudaVersion: gpu.minCudaVersion,
  }
}

export function getGpuMarket() {
  return DEFAULT_GPU_MARKET.map((gpu) => ({ ...gpu, speedByWorkerClass: { ...gpu.speedByWorkerClass } }))
}

export function rankGpuTypesForWorker({ workerClass, minCudaVersion }) {
  const scored = DEFAULT_GPU_MARKET
    .filter((gpu) => supportsCudaVersion(gpu.minCudaVersion, minCudaVersion))
    .map((gpu) => toGpuScore(gpu, workerClass))
    .sort((left, right) => {
      if (right.costEfficiency !== left.costEfficiency) {
        return right.costEfficiency - left.costEfficiency
      }

      return left.pricePerHourUsd - right.pricePerHourUsd
    })

  return scored
}

export function selectGpuCandidates({ workerClass, minCudaVersion, minimumCount = 3 }) {
  const ranked = rankGpuTypesForWorker({ workerClass, minCudaVersion })

  if (ranked.length < minimumCount) {
    throw new Error(
      `Only ${ranked.length} GPU types satisfy min CUDA ${minCudaVersion} for worker class ${workerClass}; required at least ${minimumCount}.`
    )
  }

  return ranked.slice(0, minimumCount)
}

export function summarizeRevenueOptimization({ workerClass, minCudaVersion, minimumCount = 3 }) {
  const ranked = rankGpuTypesForWorker({ workerClass, minCudaVersion })
  const selected = selectGpuCandidates({ workerClass, minCudaVersion, minimumCount })

  return {
    workerClass,
    minCudaVersion,
    ranked,
    selected,
  }
}
