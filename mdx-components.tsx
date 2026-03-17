import type { MDXComponents } from "mdx/types"
import defaultMdxComponents from "fumadocs-ui/mdx"

import { APIPage } from "./src/components/docs/api-page"
import OpenApiViewer from "./src/components/docs/OpenApiViewer"
import { SaasSubscriptionPricingTables } from "./src/components/docs/saas-subscription-pricing-tables"

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    APIPage,
    OpenApiViewer,
    SaasSubscriptionPricingTables,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
