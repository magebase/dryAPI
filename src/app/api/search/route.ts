import { source } from "@/lib/docs/source";
import { createSearchAPI } from "fumadocs-core/search/server";

export const { GET } = createSearchAPI("simple", {
  indexes: source.getPages().map((page) => ({
    title: page.data.title,
    content: page.data.description ?? page.data.title,
    url: page.url,
    id: page.url,
    structuredData: page.data.structuredData,
  })),
});
