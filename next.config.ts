import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { createMDX } from "fumadocs-mdx/next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev({ configPath: "wrangler.local.jsonc" });

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

const posthogDomains = [
  "https://us-assets.i.posthog.com",
  "https://us.i.posthog.com",
];

const siteSharedCsp = [
  "default-src 'self';",
  "img-src 'self' data: https://assets.tina.io https://assets.tinajs.io;",
  "font-src 'self' data: https://fonts.gstatic.com;",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
  "object-src 'none';",
  "worker-src 'self' blob:;",
  "base-uri 'self';",
];

const siteProductionCsp = [
  ...siteSharedCsp,
  // Tina visual editing embeds site pages from /admin on the same origin.
  "frame-ancestors 'self';",
  "frame-src 'self';",
  "script-src 'self' 'unsafe-eval';",
  "script-src-elem 'self' 'unsafe-inline';",
  "script-src-attr 'none';",
  "connect-src 'self' https://identity.tinajs.io https://identity-v2.tinajs.io https://content.tinajs.io https://assets.tinajs.io;",
];

const siteDevelopmentCsp = [
  ...siteSharedCsp,
  // TinaCMS preview runs in an iframe from the local Tina dev origin.
  "frame-ancestors 'self' http://localhost:4001;",
  // TinaCMS preview panes frame the local Next app during development.
  "frame-src 'self' http://localhost:3000;",
  // TinaCMS dev UI loads scripts and HMR from the local Vite server.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:4001;",
  "connect-src 'self' https://identity.tinajs.io https://identity-v2.tinajs.io https://content.tinajs.io https://assets.tinajs.io http://localhost:3000 http://localhost:4001 ws://localhost:4001;",
];

const adminProductionCsp = [
  ...siteSharedCsp,
  // Keep admin embeddable by same-origin Tina preview panes only.
  "frame-ancestors 'self';",
  "frame-src 'self';",
  "script-src 'self' 'unsafe-eval';",
  "connect-src 'self' https://identity.tinajs.io https://identity-v2.tinajs.io https://content.tinajs.io https://assets.tinajs.io;",
];

const adminDevelopmentCsp = [
  ...siteSharedCsp,
  // Tina admin can be embedded by the local Tina dev server.
  "frame-ancestors 'self' http://localhost:4001;",
  "frame-src 'self' http://localhost:3000;",
  // Tina dev scripts + PostHog runtime loader.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:4001 ${posthogDomains.join(" ")};`,
  // Tina APIs + PostHog ingest/config endpoints.
  `connect-src 'self' https://identity.tinajs.io https://identity-v2.tinajs.io https://content.tinajs.io https://assets.tinajs.io http://localhost:3000 http://localhost:4001 ws://localhost:4001 ${posthogDomains.join(" ")};`,
];

const siteCspValue =
  process.env.NODE_ENV === "development"
    ? siteDevelopmentCsp.join(" ")
    : siteProductionCsp.join(" ");

const adminCspValue =
  process.env.NODE_ENV === "development"
    ? adminDevelopmentCsp.join(" ")
    : adminProductionCsp.join(" ");

const pwaEnabled = parseBooleanEnv(
  process.env.FEATURE_PWA_ENABLED ??
    process.env.NEXT_PUBLIC_FEATURE_PWA_ENABLED,
  true,
);

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Avoid stale Tina admin bundles being precached across deploys.
  globPublicPatterns: ["**/*", "!admin/**/*"],
  exclude: [/^(?:\/)?admin(?:\/.*)?$/],
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.filter(
        (entry) =>
          !entry.url.startsWith("/admin/") && !entry.url.startsWith("admin/"),
      ),
      warnings: [],
    }),
  ],
  disable: process.env.NODE_ENV === "development" || !pwaEnabled,
});

const withMDX = createMDX({
  configPath: "source.config.ts",
});

const nextConfig: NextConfig = {
  typedRoutes: true,
  cacheComponents: false,
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    })

    config.module.rules.push({
      test: /\.txt$/i,
      type: "asset/source",
    });

    return config;
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: adminCspValue,
          },
        ],
      },
      {
        // Keep /admin on its dedicated policy so we don't override it with the site CSP.
        source: "/((?!admin).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: siteCspValue,
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/vite.svg",
        destination: "/file.svg",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/og",
      },
    ],
  },
};

export default withMDX(withSerwist(nextConfig));
