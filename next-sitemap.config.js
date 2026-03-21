/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://dryapi.dev").replace(/\/+$/, "")

module.exports = {
  siteUrl,
  generateIndexSitemap: false,
  generateRobotsTxt: false,
  outDir: "public",
  sitemapSize: 5000,
  autoLastmod: true,
  changefreq: "weekly",
  exclude: [
    "/admin",
    "/admin/*",
    "/api/*",
    "/dashboard",
    "/dashboard/*",
    "/forgot",
    "/login",
    "/register",
    "/reset-password",
    "/reset-password/*",
    "/success",
    "/success/*",
    "/404",
    "/500",
  ],
}
