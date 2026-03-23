import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SettingsSectionNav } from "@/components/site/dashboard/settings/settings-section-nav";

type DashboardSettingsLayoutProps = {
  children: ReactNode;
};

export default function DashboardSettingsLayout({
  children,
}: DashboardSettingsLayoutProps) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="animate-fade-in rounded-xl border border-zinc-200/80 bg-white/90 px-4 py-3 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-900/80">
        <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <Badge className="gap-1">
            <Sparkles className="size-3" />
            New
          </Badge>
          <span>
            Settings workspace is live with profile, security, webhook, and key
            controls.
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-100">
            Configure now
            <ArrowRight className="size-3.5" />
          </span>
        </p>
      </div>

      <div className="animate-slide-up space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Settings
        </h2>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <SettingsSectionNav />
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
