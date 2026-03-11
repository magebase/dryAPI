import { tinaField } from "tinacms/dist/react"

import type { SiteConfig } from "@/lib/site-content-schema"

type SiteUiTextValue = {
  value: string
  field?: string
}

export function resolveSiteUiText(site: SiteConfig, key: string, fallback: string): SiteUiTextValue {
  const entry = site.uiText.find((item) => item.key === key)

  if (!entry) {
    return { value: fallback }
  }

  return {
    value: entry.value,
    field: tinaField(entry, "value"),
  }
}
