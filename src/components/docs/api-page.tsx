import { createAPIPage } from "fumadocs-openapi/ui"

import client from "./api-page.client"
import { codeUsages } from "@/lib/openapi/code-usage"
import { mediaAdapters } from "@/lib/openapi/media"
import { openapi } from "@/lib/openapi"

export const APIPage = createAPIPage(openapi, {
  client,
  codeUsages,
  mediaAdapters,
})
