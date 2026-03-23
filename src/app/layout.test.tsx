import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "--font-manrope" }),
  DM_Sans: () => ({ variable: "--font-dm-sans" }),
  Fira_Code: () => ({ variable: "--font-fira-code" }),
}));

vi.mock("@/lib/feature-flags", () => ({
  isPwaEnabledServer: () => false,
}));

vi.mock("@/lib/site-content-loader", () => ({
  readSiteConfig: vi.fn(),
}));

vi.mock("@/lib/og/metadata", () => ({
  buildTakumiMetadata: vi.fn(),
  normalizeSiteUrl: () => "https://dryapi.dev",
}));

vi.mock("@/components/site/aos-provider", () => ({
  AosProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/site/app-providers", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/site/app-toaster", () => ({
  AppToaster: () => null,
}));

vi.mock("@/components/site/serwist-register", () => ({
  SerwistRegister: () => null,
}));

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("RootLayout", () => {
  it("marks the root html element for smooth scroll route transitions", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main />
      </RootLayout>,
    );

    expect(html).toContain('data-scroll-behavior="smooth"');
  });
});
