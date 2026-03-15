import { defineDocs, defineConfig } from "fumadocs-mdx/config"
import lastModified from "fumadocs-mdx/plugins/last-modified"

export const docs = defineDocs({
  dir: "src/content",
})

export default defineConfig({
  plugins: [lastModified()],
})