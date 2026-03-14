import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs"
import OpenApiViewer from "./src/components/docs/OpenApiViewer"

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components: Record<string, unknown> = {}) {
  return {
    ...docsComponents,
    OpenApiViewer,
    ...components,
  }
}
