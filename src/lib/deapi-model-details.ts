import type { DeapiModelDetail, DeapiModelDetailsDataset } from "@/types/deapi-model-details"
import modelDetailsJson from "../../content/pricing/deapi-model-details.json"

const MODEL_DETAILS = modelDetailsJson as DeapiModelDetailsDataset

export function getModelDetail(modelName: string): DeapiModelDetail | null {
  return MODEL_DETAILS.models[modelName] ?? null
}

export function listModelDetailSlugs(): string[] {
  return Object.keys(MODEL_DETAILS.models)
}

export function getModelDetailsDataset(): DeapiModelDetailsDataset {
  return MODEL_DETAILS
}
