"use client"

import { defineClientConfig } from "fumadocs-openapi/ui/client"

import { codeUsages } from "@/lib/openapi/code-usage"
import { mediaAdapters } from "@/lib/openapi/media"

export default defineClientConfig({
  codeUsages,
  mediaAdapters,
})
