import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./cloudflare/api/wrangler.toml",
      },
      miniflare: {
        bindings: {
          API_KEY: "test-api-key",
          API_KEY_LIMIT_PER_MINUTE: "300",
          API_KEY_LIMIT_PER_DAY: "20000",
          RUNPOD_ENDPOINT_ID_CHAT: "test-chat-endpoint",
        },
      },
    }),
  ],
  test: {
    name: "cloudflare-api-integration",
    include: ["cloudflare/api/test/integration/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov"],
      include: ["cloudflare/api/src/**/*.ts"],
      exclude: ["cloudflare/api/src/types.ts"],
    },
  },
});
