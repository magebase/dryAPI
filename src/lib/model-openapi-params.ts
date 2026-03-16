import "server-only"

import openApiJson from "../../docs/deapi-mirror/articles/openapi.json"

type OpenApiDocument = {
  paths?: Record<string, unknown>
}

const OPENAPI_DOCUMENT = openApiJson as OpenApiDocument

const INFERENCE_TYPE_TO_OPENAPI_PATHS: Record<string, string[]> = {
  "img-rmbg": ["/api/v1/client/img-rmbg"],
  img2img: ["/api/v1/client/img2img", "/api/v1/client/prompt/image2image"],
  img2txt: ["/api/v1/client/img2txt"],
  img2video: ["/api/v1/client/img2video"],
  "img-upscale": ["/api/v1/client/img-upscale"],
  txt2embedding: ["/api/v1/client/txt2embedding"],
  txt2img: ["/api/v1/client/txt2img", "/api/v1/client/prompt/image"],
  txt2music: ["/api/v1/client/txt2music"],
  txt2audio: ["/api/v1/client/txt2audio", "/api/v1/client/prompt/speech"],
  txt2video: ["/api/v1/client/txt2video", "/api/v1/client/prompt/video"],
  vid2txt: ["/api/v1/client/vid2txt", "/api/v1/client/videofile2txt"],
  videofile2txt: ["/api/v1/client/videofile2txt"],
  aud2txt: ["/api/v1/client/aud2txt", "/api/v1/client/audiofile2txt"],
  audiofile2txt: ["/api/v1/client/audiofile2txt"],
  aud2video: ["/api/v1/client/aud2video"],
  "vid-rmbg": ["/api/v1/client/vid-rmbg"],
  "vid-upscale": ["/api/v1/client/vid-upscale"],
}

function uniqueByOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }

    seen.add(value)
    output.push(value)
  }

  return output
}

function collectSchemaPropertyKeys(schema: unknown): string[] {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return []
  }

  const schemaRecord = schema as Record<string, unknown>
  const directProperties =
    schemaRecord.properties && typeof schemaRecord.properties === "object" && !Array.isArray(schemaRecord.properties)
      ? Object.keys(schemaRecord.properties as Record<string, unknown>)
      : []

  const composedKeys = ["allOf", "oneOf", "anyOf"].flatMap((key) => {
    const value = schemaRecord[key]
    if (!Array.isArray(value)) {
      return []
    }

    return value.flatMap((node) => collectSchemaPropertyKeys(node))
  })

  return uniqueByOrder([...directProperties, ...composedKeys]).sort((left, right) => left.localeCompare(right))
}

function resolveJsonPointer(root: OpenApiDocument, reference: string): unknown {
  if (!reference.startsWith("#/")) {
    return null
  }

  const segments = reference
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))

  let current: unknown = root

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function resolveSchemaRefs(schema: unknown, root: OpenApiDocument, seen: Set<string> = new Set()): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return schema
  }

  const schemaRecord = schema as Record<string, unknown>
  const reference = typeof schemaRecord.$ref === "string" ? schemaRecord.$ref : null

  if (reference) {
    if (seen.has(reference)) {
      return null
    }

    seen.add(reference)
    const resolved = resolveJsonPointer(root, reference)
    return resolveSchemaRefs(resolved, root, seen)
  }

  return schema
}

function collectRequestBodySchemaKeysFromPath(pathname: string): string[] {
  const pathItem = OPENAPI_DOCUMENT.paths?.[pathname]
  if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) {
    return []
  }

  const post = (pathItem as Record<string, unknown>).post
  if (!post || typeof post !== "object" || Array.isArray(post)) {
    return []
  }

  const requestBody = (post as Record<string, unknown>).requestBody
  const resolvedRequestBody = resolveSchemaRefs(requestBody, OPENAPI_DOCUMENT)
  if (!resolvedRequestBody || typeof resolvedRequestBody !== "object" || Array.isArray(resolvedRequestBody)) {
    return []
  }

  const content = (resolvedRequestBody as Record<string, unknown>).content
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return []
  }

  const contentRecord = content as Record<string, unknown>
  const schemaKeys = ["application/json", "multipart/form-data"].flatMap((contentType) => {
    const mediaType = contentRecord[contentType]
    if (!mediaType || typeof mediaType !== "object" || Array.isArray(mediaType)) {
      return []
    }

    const schema = resolveSchemaRefs((mediaType as Record<string, unknown>).schema, OPENAPI_DOCUMENT)
    return collectSchemaPropertyKeys(schema)
  })

  return uniqueByOrder(schemaKeys).sort((left, right) => left.localeCompare(right))
}

export function getOpenApiParameterKeysForInferenceTypes(inferenceTypes: string[]): string[] {
  const paths = uniqueByOrder(
    inferenceTypes.flatMap((inferenceType) => INFERENCE_TYPE_TO_OPENAPI_PATHS[inferenceType] ?? []),
  )

  const keys = uniqueByOrder(paths.flatMap((pathname) => collectRequestBodySchemaKeysFromPath(pathname)))
  return keys.sort((left, right) => left.localeCompare(right))
}
