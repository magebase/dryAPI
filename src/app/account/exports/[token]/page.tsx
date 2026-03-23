import type { Metadata } from "next";

import { AccountExportUnlockForm } from "@/components/site/account-export-unlock-form";

type AccountExportPageProps = {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Secure export | dryAPI",
  description: "Enter the one-time code to unlock your private account export.",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AccountExportPage({ params }: AccountExportPageProps) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-16">
      <AccountExportUnlockForm token={token} />
    </main>
  )
}