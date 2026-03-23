import type { Metadata } from "next";

import { AccountExportUnlockForm } from "@/components/site/account-export-unlock-form";
import { buildTakumiMetadata } from "@/lib/og/metadata";
import { readSiteConfig } from "@/lib/site-content-loader";

type AccountExportPageProps = {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();

  return buildTakumiMetadata({
    title: "Secure export | dryAPI",
    description: "Enter the one-time code to unlock your private account export.",
    canonicalPath: "/account/exports",
    template: "dashboard",
    siteName: site.brand.name || site.brand.mark,
    robots: {
      index: false,
      follow: false,
    },
    label: "Dashboard",
    seed: "account-export",
  });
}

export default async function AccountExportPage({ params }: AccountExportPageProps) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-16">
      <AccountExportUnlockForm token={token} />
    </main>
  )
}