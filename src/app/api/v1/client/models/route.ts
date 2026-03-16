import { NextRequest, NextResponse } from "next/server"

import {
  parseInferenceTypeFilter,
  parsePositiveInt,
  requireApiTokenIfConfigured,
} from "@/app/api/v1/client/_shared"
import { getOpenApiParameterKeysForInferenceTypes } from "@/lib/model-openapi-params"
import { getActiveRunpodModelsGeneratedAt, listActiveRunpodModels } from "@/lib/runpod-active-models"

export const runtime = "nodejs"

type ClientModelRecord = {
  id: string
  slug: string
  model: string
  inference_types: string[]
  categories: string[]
  parameter_keys: string[]
}

function buildModelRecords(): ClientModelRecord[] {
  return listActiveRunpodModels()
    .map((model) => ({
      id: model.slug,
      slug: model.slug,
      model: model.slug,
      inference_types: [...model.inferenceTypes],
      categories: [...model.categories],
      parameter_keys: getOpenApiParameterKeysForInferenceTypes(model.inferenceTypes),
    }))
    .sort((left, right) => left.model.localeCompare(right.model))
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
      generated_at: getActiveRunpodModelsGeneratedAt(),
    },
  })
}
