import { NextResponse } from "next/server";

import { getOpenApiParameterKeysForInferenceTypes } from "@/lib/model-openapi-params";
import {
  getActiveRunpodModelsGeneratedAt,
  listActiveRunpodModels,
} from "@/lib/runpod-active-models";

type PlaygroundModelRecord = {
  id: string;
  slug: string;
  model: string;
  display_name: string;
  inference_types: string[];
  categories: string[];
  parameter_keys: string[];
};

function buildPlaygroundModels(): PlaygroundModelRecord[] {
  return listActiveRunpodModels()
    .map((model) => ({
      id: model.slug,
      slug: model.slug,
      model: model.slug,
      display_name: model.displayName,
      inference_types: [...model.inferenceTypes],
      categories: [...model.categories],
      parameter_keys: getOpenApiParameterKeysForInferenceTypes(
        model.inferenceTypes,
      ),
    }))
    .sort((left, right) => left.model.localeCompare(right.model));
}

export async function GET() {
  const data = buildPlaygroundModels();

  return NextResponse.json({
    data,
    count: data.length,
    total: data.length,
    meta: {
      generated_at: getActiveRunpodModelsGeneratedAt(),
    },
  });
}
