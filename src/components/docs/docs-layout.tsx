import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";

import { OpenApiSidebarItem } from "@/components/docs/openapi-sidebar-item";
import { BrandLogo } from "@/components/site/brand-logo";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDocsPageTree } from "@/lib/docs/source";
import { type BrandProfile } from "@/lib/brand-catalog";

import "fumadocs-openapi/css/preset.css";

type DocumentationLayoutProps = {
  locale: string;
  brand: BrandProfile;
  children: ReactNode;
};

export function DocumentationLayout({
  locale,
  brand,
  children,
}: DocumentationLayoutProps) {
  const docsHomeUrl = locale === DEFAULT_LOCALE ? "/docs" : `/${locale}/docs`;
  const tree = getDocsPageTree(locale);

  const headerLinks: LinkItemType[] = [
    {
      text: "Dashboard",
      url: `${brand.siteUrl}/dashboard`,
      external: true,
      active: "none",
    },
    {
      text: "Status",
      url: `https://status.${brand.key}.ai/`,
      external: true,
      active: "none",
    },
    {
      type: "button",
      text: "Get API Key",
      url: `${brand.siteUrl}/dashboard`,
      external: true,
      active: "none",
    },
  ];

  const sidebarLinks = [
    {
      text: "llms.txt",
      url: "/llms.txt",
    },
    {
      text: "llms-full.txt",
      url: "/llms-full.txt",
    },
  ];

  return (
    <div className="docs-root min-h-screen bg-fd-background text-fd-foreground [&_#nd-subnav]:max-w-none [&_#nd-subnav_div[data-header-body]]:max-w-none [&_header#nd-subnav]:max-w-none [&_header#nd-subnav_>_div]:max-w-none [&_div[data-header-body]]:max-w-none">
      <RootProvider
        search={{
          enabled: true,
          links: [
            ["Dashboard", "/dashboard"],
            ["API Reference", "/docs/v1/api-reference"],
          ],
        }}
        theme={{
          defaultTheme: "light",
          enableSystem: false,
          forcedTheme: "light",
        }}
      >
        <DocsLayout
          tree={tree}
          links={headerLinks}
          sidebar={{
            defaultOpenLevel: 1,
            components: {
              Item: OpenApiSidebarItem,
            },
            banner: (
              <div className="flex flex-col gap-1 p-2 border-b">
                {sidebarLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    className="text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground px-2 py-1.5 rounded-md hover:bg-fd-accent transition-colors"
                  >
                    {link.text}
                  </a>
                ))}
              </div>
            ),
          }}
          githubUrl={`https://github.com/${brand.key}-ai`}
          i18n={false}
          nav={{
            mode: "top",
            title: (
              <BrandLogo
                mark={brand.mark}
                size="sm"
                tone="dark"
                className="gap-2"
              />
            ),
            url: docsHomeUrl,
          }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
