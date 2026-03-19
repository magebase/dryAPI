import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Layers2 } from "lucide-react";

import { ModelsCatalog } from "@/components/site/dashboard/models-catalog";
import { WebPageJsonLd } from "@/components/site/seo-jsonld";
import { SiteFrame } from "@/components/site/site-frame";
import { buildTakumiMetadata } from "@/lib/og/metadata";
import { readSiteConfig } from "@/lib/site-content-loader";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();
  const siteName = site.brand.name || site.brand.mark;

  return buildTakumiMetadata({
    title: `Models | ${siteName}`,
    description:
      "Browse the live model catalog by task type and compare public model detail and pricing routes before integration.",
    keywords: [
      "AI model catalog",
      "model pricing",
      "inference models",
      "unified model API",
      `${siteName} models`,
    ],
    canonicalPath: "/models",
    template: "marketing",
    siteName,
    openGraphTitle: `Browse All API Models | ${siteName}`,
    label: "Marketing",
    seed: "models-index",
  });
}

export default async function ModelsIndexPage() {
  const site = await readSiteConfig();
  const siteName = site.brand.name || site.brand.mark;

  return (
    <SiteFrame site={site}>
      <WebPageJsonLd
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Models", path: "/models" },
        ]}
        description="Browse the live model catalog by task type and compare public model detail and pricing routes before integration."
        path="/models"
        scriptId="models-index"
        title={`Models | ${siteName}`}
      />
      <main className="animate-page-in overflow-x-clip bg-slate-100/30 pb-16 md:pb-24 dark:bg-zinc-950">
        <section className="relative overflow-hidden border-b border-slate-200/60 bg-white py-16 md:py-24 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <div className="absolute inset-x-0 -top-40 -z-10 h-96 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent blur-3xl opacity-50" />
          
          <div className="mx-auto max-w-7xl px-4 text-center sm:text-left">
            <Badge
              variant="outline"
              className="mb-4 border-primary/20 bg-primary/5 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-primary"
            >
              Model Catalog
            </Badge>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-6xl dark:text-white">
              Optimize for{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Every Workload
              </span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-slate-500 dark:text-zinc-400">
              Explore active models grouped by inference capability. We provide 
              production-ready endpoints with guaranteed performance and competitive 
              pricing across text, image, and audio domains.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Button asChild variant="outline" className="h-11 border-slate-200 px-6 text-xs font-bold uppercase tracking-wider dark:border-zinc-800">
                <Link href="/pricing">
                  Compare Pricing
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 px-6 text-xs font-bold uppercase tracking-wider">
                <Link href="/docs/v1/openapi">
                  OpenAPI Reference
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:py-20">
          <ModelsCatalog routeBasePath="/models" />
        </section>
      </main>
    </SiteFrame>
  );
}
