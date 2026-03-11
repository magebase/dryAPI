import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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
  "frame-ancestors 'none';",
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
  "frame-ancestors 'none';",
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

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
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
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default withSerwist(nextConfig);
