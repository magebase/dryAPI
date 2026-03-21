"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BookText,
  Bot,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Rss,
  Settings2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { modelCategories } from "@/components/site/dashboard/model-categories";
import { buildModelTaskSectionId } from "@/components/site/dashboard/model-section-id";
import { signOutCurrentSession } from "@/lib/auth-session-actions";
import { cn } from "@/lib/utils";
import { BrandLogo } from "../brand-logo";

type DashboardShellProps = {
  children: ReactNode;
};

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavItemClass(active: boolean, nested = false) {
  return cn(
    "relative my-px flex w-full items-center rounded-lg border text-start transition-colors",
    nested
      ? "h-8 gap-2.5 px-2.5 text-[13px] text-zinc-500 lg:h-7"
      : "h-10 gap-3 px-3 text-sm text-zinc-500 lg:h-8",
    "hover:border-zinc-300/90 hover:bg-zinc-900/[0.045] hover:text-zinc-900 dark:text-white/80 dark:hover:border-white/15 dark:hover:bg-white/[0.08] dark:hover:text-white",
    active
      ? "border-zinc-300/95 bg-white text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/15 dark:bg-white/[0.1] dark:text-white"
      : "border-transparent",
  );
}

function getDisclosureButtonClass(active: boolean) {
  return cn(
    "mb-[2px] flex h-10 w-full items-center gap-3 rounded-lg border px-3 text-start text-sm transition-colors lg:h-8",
    "text-zinc-500 hover:border-zinc-300/90 hover:bg-zinc-900/[0.045] hover:text-zinc-900 dark:text-white/80 dark:hover:border-white/15 dark:hover:bg-white/[0.08] dark:hover:text-white",
    active
      ? "border-zinc-300/95 bg-white text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/15 dark:bg-white/[0.1] dark:text-white"
      : "border-transparent",
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(true);
  const [signOutPending, setSignOutPending] = useState(false);
  const modelsSectionActive = pathname.startsWith("/dashboard/models");

  async function handleSignOut() {
    if (signOutPending) {
      return;
    }

    setSignOutPending(true);

    try {
      await signOutCurrentSession();

      setMobileSidebarOpen(false);
      window.location.replace("/login");
    } catch {
      toast.error("Unable to sign out");
    } finally {
      setSignOutPending(false);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/dashboard/models")) {
      return "Models";
    }

    if (pathname.startsWith("/dashboard/billing")) {
      return "Billing";
    }

    if (pathname.startsWith("/dashboard/settings")) {
      return "Settings";
    }

    return "Overview";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-zinc-100/85 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[16rem_1fr]">
        <aside
          className={cn(
            "z-20 flex w-64 flex-col gap-3 border-e border-zinc-200 bg-zinc-50 px-3.5 py-4 transition-transform dark:border-zinc-700 dark:bg-zinc-900",
            "max-h-dvh overflow-y-auto overscroll-contain",
            "max-lg:fixed max-lg:start-0 max-lg:top-0 max-lg:min-h-dvh max-lg:max-h-dvh",
            mobileSidebarOpen
              ? "max-lg:translate-x-0"
              : "max-lg:-translate-x-full",
            "lg:sticky lg:top-0 lg:translate-x-0",
          )}
          data-flux-sidebar
        >
          <Link
            href="/dashboard"
            prefetch={false}
            className="mb-1 me-5 flex items-center space-x-2 rtl:space-x-reverse"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <BrandLogo size="sm" tone="light" className="!gap-2" />
          </Link>

          <nav
            className="flex min-h-auto flex-col overflow-visible"
            data-flux-navlist
          >
            <Link
              href="/dashboard"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(pathname === "/dashboard")}
            >
              <LayoutDashboard className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                Overview
              </span>
            </Link>

            <div className="group/disclosure grid" data-flux-navlist-group>
              <button
                type="button"
                className={getDisclosureButtonClass(modelsSectionActive)}
                onClick={() => setModelsOpen((current) => !current)}
                aria-expanded={modelsOpen}
                aria-controls="dashboard-models-nav"
              >
                <Bot className="size-4" />
                <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                  Models
                </span>
                <span className="pe-1">
                  {modelsOpen ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                </span>
              </button>

              <div
                id="dashboard-models-nav"
                className={cn(
                  "relative space-y-[2px] ps-7",
                  modelsOpen ? "block" : "hidden",
                )}
              >
                <div className="absolute inset-y-[3px] start-0 ms-4 w-px bg-zinc-300/80 dark:bg-white/20" />

                <Link
                  href="/dashboard/models"
                  prefetch={false}
                  className={getNavItemClass(
                    pathname === "/dashboard/models",
                    true,
                  )}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <span className="flex-1 whitespace-nowrap font-medium leading-none">
                    All Models
                  </span>
                </Link>

                {modelCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/dashboard/models#${buildModelTaskSectionId(category.slug)}`}
                    prefetch={false}
                    className={getNavItemClass(false, true)}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <span className="flex-1 whitespace-nowrap font-medium leading-none">
                      {category.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/dashboard/billing"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(
                isRouteActive(pathname, "/dashboard/billing"),
              )}
            >
              <WalletCards className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                Billing
              </span>
            </Link>

            <Link
              href="/dashboard/settings/general"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(
                isRouteActive(pathname, "/dashboard/settings"),
              )}
            >
              <Settings2 className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                Settings
              </span>
            </Link>
          </nav>

          <div className="flex-1" />

          {/* <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/10">
            <a
              href="https://www.trustpilot.com/review/dryapi.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-800 transition-opacity hover:opacity-80 dark:text-white"
            >
              <span>Review on Trustpilot</span>
              <ExternalLink className="size-4" />
            </a>
          </div> */}

          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/10">
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-white">
              <LifeBuoy className="size-4" />
              <span>Need Help?</span>
            </p>
            <nav
              className="flex min-h-auto flex-col overflow-visible"
              data-flux-navlist
            >
              <a
                href="https://x.com/intent/follow?screen_name=dryAPI_"
                target="_blank"
                rel="noopener noreferrer"
                className={getNavItemClass(false)}
              >
                <Rss className="size-4" />
                <span>News & Updates</span>
              </a>
              <a
                href="https://discord.com/invite/UFfK5YRBsr"
                target="_blank"
                rel="noopener noreferrer"
                className={getNavItemClass(false)}
              >
                <Users className="size-4" />
                <span>Join Discord</span>
              </a>
            </nav>
          </div>

          <nav
            className="flex min-h-auto flex-col overflow-visible"
            data-flux-navlist
          >
            <Link
              href="/dashboard/settings/api-keys"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(
                isRouteActive(pathname, "/dashboard/settings/api-keys"),
              )}
            >
              <KeyRound className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                API Keys
              </span>
            </Link>

            <Link
              href="/plans"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(pathname === "/plans")}
            >
              <BadgeDollarSign className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                Plans
              </span>
            </Link>

            <Link
              href="/docs/v1"
              prefetch={false}
              onClick={() => setMobileSidebarOpen(false)}
              className={getNavItemClass(pathname.startsWith("/docs"))}
            >
              <BookText className="size-4" />
              <span className="flex-1 whitespace-nowrap text-sm font-medium leading-none">
                Documentation
              </span>
            </Link>
          </nav>
        </aside>

        {mobileSidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-10 bg-black/40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
        ) : null}

        <section className="relative flex min-h-screen flex-col lg:max-h-screen">
          <header className="sticky top-0 z-[5] flex h-16 items-center justify-between border-b border-zinc-200/80 bg-zinc-100/90 px-4 backdrop-blur lg:px-8 dark:border-zinc-700/80 dark:bg-zinc-950/90">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="size-4" />
              </Button>
              {/* <span className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">dryAPI dashboard</span> */}
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {pageTitle}
              </h1>
            </div>

            {mobileSidebarOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </header>

          <main className="flex-1 animate-page-in overflow-y-auto p-4 lg:p-8">
            {children}
          </main>
        </section>
      </div>
    </div>
  );
}
