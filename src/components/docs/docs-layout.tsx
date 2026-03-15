import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";

import { OpenApiSidebarItem } from "@/components/docs/openapi-sidebar-item";
import { DryApiLogo } from "@/components/site/dryapi-logo";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDocsPageTree } from "@/lib/docs/source";

import "fumadocs-openapi/css/preset.css";

type DocumentationLayoutProps = {
  locale: string;
  children: ReactNode;
};

const DOCS_HEADER_LINKS: LinkItemType[] = [
  {
    text: "Dashboard",
    url: "https://deapi.ai/dashboard",
    external: true,
    active: "none",
  },
  {
    text: "Status",
    url: "https://status.deapi.ai/",
    external: true,
    active: "none",
  },
  {
    type: "button",
    text: "Get API Key",
    url: "https://deapi.ai/dashboard",
    external: true,
    active: "none",
  },
];

export function DocumentationLayout({
  locale,
  children,
}: DocumentationLayoutProps) {
  const docsHomeUrl = locale === DEFAULT_LOCALE ? "/docs" : `/${locale}/docs`;

  return (
    <div className="docs-root min-h-screen bg-fd-background text-fd-foreground">
      <RootProvider
        theme={{
          defaultTheme: "light",
          enableSystem: false,
          forcedTheme: "light",
        }}
      >
        <DocsLayout
          tree={getDocsPageTree(locale)}
          links={DOCS_HEADER_LINKS}
          githubUrl="https://github.com/deapi-ai"
          i18n={false}
          nav={{
            mode: "top",
            title: <DryApiLogo size="sm" tone="light" className="gap-2" />,
            url: docsHomeUrl,
          }}
          sidebar={{
            defaultOpenLevel: 1,
            components: {
              Item: OpenApiSidebarItem,
            },
          }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
