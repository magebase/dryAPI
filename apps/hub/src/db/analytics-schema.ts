import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

// API provider registry — the core entity for the discovery hub
export const apiProvider = sqliteTable(
  "api_provider",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    websiteUrl: text("website_url"),
    docsUrl: text("docs_url"),
    logoUrl: text("logo_url"),
    category: text("category").notNull().default("llm"),
    tags: text("tags"), // JSON array
    pricingType: text("pricing_type").default("pay-as-you-go"),
    // Benchmark data (cached from periodic job)
    latencyP50Ms: real("latency_p50_ms"),
    latencyP95Ms: real("latency_p95_ms"),
    uptimePercent: real("uptime_percent"),
    trustScore: real("trust_score"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    slugUnique: index("idx_api_provider_slug").on(table.slug),
    categoryIndex: index("idx_api_provider_category").on(table.category),
    featuredIndex: index("idx_api_provider_featured").on(table.featured),
  }),
)

// Use-case page metadata
export const useCase = sqliteTable(
  "use_case",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    // JSON array of api_provider.slug values ordered by recommendation
    recommendedApis: text("recommended_apis"),
    searchVolume: integer("search_volume"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    slugUnique: index("idx_use_case_slug").on(table.slug),
  }),
)

// Page view analytics (lightweight, privacy-preserving)
export const pageView = sqliteTable(
  "page_view",
  {
    id: text("id").primaryKey(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    country: text("country"),
    // bucket by date (YYYY-MM-DD) for aggregation
    dateBucket: text("date_bucket").notNull(),
    count: integer("count").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pathDateIndex: index("idx_page_view_path_date").on(table.path, table.dateBucket),
    dateIndex: index("idx_page_view_date").on(table.dateBucket),
  }),
)

export const analyticsSchema = {
  apiProvider,
  useCase,
  pageView,
}
