import { NextRequest, NextResponse } from "next/server"

import {
  parseInferenceTypeFilter,
  parsePositiveInt,
  requireApiTokenIfConfigured,
} from "@/app/api/v1/client/_shared"
import { DEAPI_MODEL_CATALOG } from "@/data/deapi-model-catalog"

export const runtime = "nodejs"

type ClientModelRecord = {
  id: string
  slug: string
  model: string
  inference_types: string[]
  categories: string[]
  parameter_keys: string[]
}

const CATEGORY_TO_INFERENCE_TYPE: Record<string, string> = {
  "background-removal": "img_rmbg",
  "image-to-image": "img2img",
  "image-to-text": "img2txt",
  "image-to-video": "img2video",
  "image-upscale": "img_upscale",
  "text-to-embedding": "txt2embedding",
  "text-to-image": "txt2img",
  "text-to-music": "txt2music",
  "text-to-speech": "txt2audio",
  "text-to-video": "txt2video",
  "video-to-text": "vid2txt",
}

function buildModelRecords(): ClientModelRecord[] {
  const records = new Map<string, ClientModelRecord>()

  for (const [category, models] of Object.entries(DEAPI_MODEL_CATALOG.modelsByCategory)) {
    const inferenceType = CATEGORY_TO_INFERENCE_TYPE[category]
    const parameterKeys = DEAPI_MODEL_CATALOG.parameterKeysByCategory[category] ?? []

    for (const modelName of models) {
      const existing = records.get(modelName)

      if (existing) {
        if (!existing.categories.includes(category)) {
          existing.categories.push(category)
        }

        if (inferenceType && !existing.inference_types.includes(inferenceType)) {
          existing.inference_types.push(inferenceType)
        }

        for (const parameterKey of parameterKeys) {
          if (!existing.parameter_keys.includes(parameterKey)) {
            existing.parameter_keys.push(parameterKey)
          }
        }

        continue
      }

      records.set(modelName, {
        id: modelName,
        slug: modelName,
        model: modelName,
        inference_types: inferenceType ? [inferenceType] : [],
        categories: [category],
        parameter_keys: [...parameterKeys],
      })
    }
  }

  return Array.from(records.values()).sort((left, right) => left.model.localeCompare(right.model))
}

function applyInferenceTypeFilter(models: ClientModelRecord[], filters: Set<string>): ClientModelRecord[] {
  if (filters.size === 0) {
    return models
  }

  return models.filter((model) => model.inference_types.some((inferenceType) => filters.has(inferenceType)))
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiTokenIfConfigured(request)
  if (unauthorized) {
    return unauthorized
  }

  const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1, 10_000)
  const perPage = parsePositiveInt(request.nextUrl.searchParams.get("per_page"), 15, 200)
  const inferenceTypeFilters = parseInferenceTypeFilter(request.nextUrl.searchParams)

  const filteredModels = applyInferenceTypeFilter(buildModelRecords(), inferenceTypeFilters)

  const total = filteredModels.length
  const totalPages = total === 0 ? 1 : Math.ceil(total / perPage)
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * perPage
  const data = filteredModels.slice(offset, offset + perPage)

  return NextResponse.json({
    data,
    count: total,
    total,
    meta: {
      page: currentPage,
      per_page: perPage,
      count: data.length,
      total,
      total_pages: totalPages,
      generated_at: DEAPI_MODEL_CATALOG.generatedAt,
    },
  })
}
