import {
  createCodeUsageGeneratorRegistry,
  type CodeUsageGenerator,
} from "fumadocs-openapi/requests/generators"
import { registerDefault } from "fumadocs-openapi/requests/generators/all"

export const codeUsages = createCodeUsageGeneratorRegistry()

registerDefault(codeUsages)

const dryApiFetch: CodeUsageGenerator = {
  label: "dryAPI fetch",
  lang: "js",
  generate(url, data, { mediaAdapters }) {
    const endpoint = url.startsWith("/") ? url : `/${url}`
    const mediaType = data.bodyType ?? "application/json"
    const adapter = mediaAdapters[mediaType]
    const encodedBody = adapter ? adapter.encode({ body: data.body ?? {} }) : JSON.stringify(data.body ?? {})
    const bodyText = typeof encodedBody === "string" ? encodedBody : "{}"

    return [
      `const response = await fetch(${JSON.stringify(endpoint)}, {`,
      `  method: ${JSON.stringify(data.method.toUpperCase())},`,
      "  headers: {",
      "    \"Content-Type\": \"application/json\",",
      "    Authorization: \"Bearer $API_KEY\",",
      "  },",
      `  body: JSON.stringify(${bodyText}),`,
      "});",
      "const result = await response.json();",
      "console.log(result);",
    ].join("\n")
  },
}

codeUsages.add("dryapi-fetch", dryApiFetch)
