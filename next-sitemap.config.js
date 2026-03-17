/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://dryapi.dev").replace(/\/+$/, "")

module.exports = {
  siteUrl,
  generateRobotsTxt: false,
  outDir: "public",
  sitemapSize: 5000,
  autoLastmod: true,
  changefreq: "weekly",
  exclude: ["/admin/*", "/api/*", "/404", "/500"],
}
