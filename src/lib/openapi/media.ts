import type { MediaAdapter } from "fumadocs-openapi"

export const mediaAdapters: Record<string, MediaAdapter> = {
  "application/json": {
    encode(data) {
      return JSON.stringify(data.body ?? {})
    },
    generateExample(data, ctx) {
      const body = JSON.stringify(data.body ?? {}, null, 2)

      if (ctx.lang === "js") {
        return `const body = ${body};`
      }

      if (ctx.lang === "python") {
        return `body = ${body}`
      }

      if (ctx.lang === "go" && "addImport" in ctx) {
        ctx.addImport("strings")
        return `body := strings.NewReader(${JSON.stringify(body)})`
      }

      return undefined
    },
  },
}
