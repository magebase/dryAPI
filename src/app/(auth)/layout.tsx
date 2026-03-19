import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/site/brand-logo";
import { buildTakumiMetadata } from "@/lib/og/metadata";
import { readSiteConfig } from "@/lib/site-content-loader";

;

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();

  return buildTakumiMetadata({
    title: "Account Access | dryAPI",
    description: "Secure account access for sign in, account recovery, and onboarding.",
    canonicalPath: "/login",
    template: "dashboard",
    siteName: site.brand.name || site.brand.mark,
    robots: {
      index: false,
      follow: false,
    },
    label: "Dashboard",
    seed: "auth-layout",
  });
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white antialiased">
      <main className="flex items-center justify-center p-8 bg-white text-slate-900 border-r border-slate-100">
        <div className="w-full max-w-md">
          <header className="mb-8">
            <Link
              href="/"
              className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2"
            >
              <BrandLogo size="sm" tone="light" className="!gap-2" />
            </Link>
          </header>
          {children}
        </div>
      </main>

      <aside
        className="hidden lg:flex items-center justify-center p-12 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--cta-cool-a), var(--cta-cool-mid) 45%, var(--cta-cool-b) 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_40%)]" />
        <div className="max-w-lg text-white space-y-8 relative z-10">
          <div className="space-y-4">
            <h2 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
              Fast inference.
              <br />
              Controlled deployment.
            </h2>
            <p className="text-xl text-white/90 font-medium leading-relaxed">
              Unified inference APIs, built for production: model routing,
              billing, and policy guardrails.
            </p>
          </div>

          <div className="flex gap-4">
            <Link
              href="/docs"
              className="px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all font-semibold text-sm"
            >
              Documentation
            </Link>
            <Link
              href="/plans"
              className="px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all font-semibold text-sm"
            >
              View Plans
            </Link>
          </div>

          <div className="pt-12 border-t border-white/10">
            <p className="text-sm font-bold uppercase tracking-widest text-white/60 mb-4">
              Trusted by modern teams
            </p>
            <div className="flex gap-8 opacity-50 grayscale invert">
              {/* Placeholder for partner logos as mentioned in AGENTS.md */}
              <div className="h-6 w-24 bg-white/20 rounded" />
              <div className="h-6 w-24 bg-white/20 rounded" />
              <div className="h-6 w-24 bg-white/20 rounded" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
