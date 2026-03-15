"use client";

import { Search } from "lucide-react";

type DocsSearchTriggerProps = {
  compact?: boolean;
};

function dispatchSearchShortcut() {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const keyboardEvent = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(keyboardEvent);
  document.dispatchEvent(keyboardEvent);
}

export function DocsSearchTrigger({ compact = false }: DocsSearchTriggerProps) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={dispatchSearchShortcut}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-fd-border bg-fd-card text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-border/90 hover:bg-fd-accent transition-colors"
        aria-label="Open search"
      >
        <Search className="size-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={dispatchSearchShortcut}
      className="group/search flex w-full max-w-[560px] items-center justify-between gap-2 rounded-xl border border-fd-border bg-fd-card px-3.5 py-2 text-sm text-fd-muted-foreground hover:border-fd-border/90 hover:bg-fd-accent transition-colors"
      id="search-bar-entry"
      aria-label="Open search"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0 text-fd-muted-foreground group-hover/search:text-fd-foreground" />
        <span className="truncate">Search dryAPI docs...</span>
      </span>
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-fd-muted-foreground">
        Ctrl K
      </span>
    </button>
  );
}
