"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  Clock3,
  Filter,
  RefreshCcw,
  Search,
  ChevronRight,
  Layers,
  CreditCard,
  LayoutGrid,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  findPricingCategoryBySlug,
  listPricingCategories,
  toCategorySummaryRows,
  toPricingCategoryLabel,
  toPricingCategorySlug,
} from "@/lib/deapi-pricing-utils";
import type {
  DeapiPricingPermutation,
  DeapiPricingSnapshot,
} from "@/types/deapi-pricing";

const pricingSearchSchema = z.string().trim().max(120)

const EMPTY_PERMUTATIONS: DeapiPricingPermutation[] = [];
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type GroupedPricingRow = {
  id: string;
  modelName: string;
  categories: string[];
  categorySummary: string;
  representative: DeapiPricingPermutation;
  representativeParamText: string;
  commonParamCount: number;
  rows: DeapiPricingPermutation[];
  latestScrapedAt: string;
};

function formatCountLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatUsd(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "N/A";
  }

  if (amount >= 1) {
    return `$${amount.toFixed(3)}`;
  }

  return `$${amount.toFixed(6)}`;
}

function formatCredits(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "N/A";
  }

  if (amount >= 1) {
    return `${amount.toFixed(3)} credits`;
  }

  return `${amount.toFixed(6)} credits`;
}

function toParamText(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return "";
  }

  const preview = entries
    .slice(0, 3)
    .map(([key, value]) => `${key.replace(/[_-]+/g, " ")}=${String(value)}`);
  const suffix = entries.length > 3 ? ` (+${entries.length - 3} more)` : "";

  return preview.join(", ") + suffix;
}

function toParamSignature(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  return entries.map(([key, value]) => `${key}=${String(value)}`).join("|");
}

function compareNullableNumberAsc(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function pickRepresentativeRow(rows: DeapiPricingPermutation[]): {
  representative: DeapiPricingPermutation;
  commonParamCount: number;
} {
  const bySignature = new Map<
    string,
    { count: number; representative: DeapiPricingPermutation }
  >();

  for (const row of rows) {
    const signature = toParamSignature(row.params);
    const existing = bySignature.get(signature);

    if (existing) {
      existing.count += 1;

      const currentCandidate = existing.representative;
      const currentPrice = currentCandidate.priceUsd ?? null;
      const nextPrice = row.priceUsd ?? null;
      const priceComparison = compareNullableNumberAsc(nextPrice, currentPrice);

      if (priceComparison < 0) {
        existing.representative = row;
      }
      continue;
    }

    bySignature.set(signature, { count: 1, representative: row });
  }

  let best: { count: number; representative: DeapiPricingPermutation } | null =
    null;
  for (const candidate of bySignature.values()) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.count > best.count) {
      best = candidate;
      continue;
    }

    if (candidate.count === best.count) {
      const candidatePrice = candidate.representative.priceUsd ?? null;
      const bestPrice = best.representative.priceUsd ?? null;
      if (compareNullableNumberAsc(candidatePrice, bestPrice) < 0) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return { representative: rows[0], commonParamCount: 1 };
  }

  return {
    representative: best.representative,
    commonParamCount: best.count,
  };
}

function toGroupedPricingRows(
  permutations: DeapiPricingPermutation[],
): GroupedPricingRow[] {
  const groups = new Map<string, DeapiPricingPermutation[]>();

  for (const row of permutations) {
    const modelName = row.modelLabel || row.model;
    const key = modelName;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return [...groups.values()].map((rows) => {
    const sortedRows = [...rows].sort((left, right) => {
      const categoryCompare = left.category.localeCompare(right.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return toParamText(left.params).localeCompare(toParamText(right.params));
    });

    const { representative, commonParamCount } =
      pickRepresentativeRow(sortedRows);
    const categories = [...new Set(sortedRows.map((row) => row.category))].sort(
      (left, right) => left.localeCompare(right),
    );

    const categorySummary =
      categories.length <= 1
        ? toPricingCategoryLabel(categories[0] ?? "")
        : `${toPricingCategoryLabel(categories[0] ?? "")} +${categories.length - 1}`;

    const latestTimestamp = sortedRows.reduce((latest, row) => {
      const timestamp = Date.parse(row.scrapedAt);
      if (!Number.isFinite(timestamp)) {
        return latest;
      }

      return Math.max(latest, timestamp);
    }, 0);

    return {
      id: rows[0]?.modelLabel || rows[0]?.model || "model",
      modelName: rows[0]?.modelLabel || rows[0]?.model || "",
      categories,
      categorySummary,
      representative,
      representativeParamText: toParamText(representative.params),
      commonParamCount,
      rows: sortedRows,
      latestScrapedAt:
        latestTimestamp > 0
          ? new Date(latestTimestamp).toISOString()
          : representative.scrapedAt,
    };
  });
}

type SortKey = "category" | "model" | "priceUsd" | "credits" | "scrapedAt";
type SortDirection = "asc" | "desc";

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSortValue(
  entry: GroupedPricingRow,
  key: SortKey,
): string | number {
  if (key === "category") {
    return entry.categorySummary.toLowerCase();
  }

  if (key === "model") {
    return entry.modelName.toLowerCase();
  }

  if (key === "priceUsd") {
    return entry.representative.priceUsd ?? Number.POSITIVE_INFINITY;
  }

  if (key === "credits") {
    return entry.representative.credits ?? Number.POSITIVE_INFINITY;
  }

  const timestamp = Date.parse(entry.latestScrapedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareEntries(
  left: GroupedPricingRow,
  right: GroupedPricingRow,
  key: SortKey,
  direction: SortDirection,
): number {
  const leftValue = resolveSortValue(left, key);
  const rightValue = resolveSortValue(right, key);

  let comparison = 0;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    comparison = leftValue - rightValue;
  } else {
    comparison = String(leftValue).localeCompare(String(rightValue));
  }

  return direction === "asc" ? comparison : comparison * -1;
}

function getSortLabel(key: SortKey): string {
  if (key === "category") {
    return "Category";
  }

  if (key === "model") {
    return "Model";
  }

  if (key === "priceUsd") {
    return "Price";
  }

  if (key === "credits") {
    return "Credits";
  }

  return "Updated";
}

export function PricingTable({
  snapshot,
  lockedCategory,
}: {
  snapshot?: DeapiPricingSnapshot | null;
  lockedCategory?: string | null;
}) {
  const permutations = snapshot?.permutations ?? EMPTY_PERMUTATIONS;
  const categories = useMemo(() => listPricingCategories(snapshot), [snapshot]);
  const resolvedLockedCategory = useMemo(() => {
    if (!lockedCategory) {
      return null;
    }

    return findPricingCategoryBySlug(categories, lockedCategory);
  }, [categories, lockedCategory]);

  const allGroupedRows = useMemo(
    () => toGroupedPricingRows(permutations),
    [permutations],
  );
  const categorySummary = useMemo(
    () => toCategorySummaryRows(permutations),
    [permutations],
  );

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("priceUsd");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  const effectiveSelectedCategory = resolvedLockedCategory ?? selectedCategory;

  const categoryScopedPermutations = useMemo(() => {
    if (effectiveSelectedCategory === "all") {
      return permutations;
    }

    return permutations.filter(
      (row) => row.category === effectiveSelectedCategory,
    );
  }, [effectiveSelectedCategory, permutations]);

  const groupedRows = useMemo(
    () => toGroupedPricingRows(categoryScopedPermutations),
    [categoryScopedPermutations],
  );

  const modelOptions = useMemo(() => {
    const rows =
      effectiveSelectedCategory === "all" ? allGroupedRows : groupedRows;

    return [...new Set(rows.map((entry) => entry.modelName))].sort(
      (left, right) => left.localeCompare(right),
    );
  }, [allGroupedRows, effectiveSelectedCategory, groupedRows]);

  const filteredRows = useMemo(() => {
    const search = normalizeSearch(searchInput);

    const rows = groupedRows.filter((entry) => {
      const modelName = entry.modelName;
      if (selectedModel !== "all" && modelName !== selectedModel) {
        return false;
      }

      if (!search) {
        return true;
      }

      const representativeParamText =
        entry.representativeParamText.toLowerCase();
      const anyParamText = entry.rows
        .map((row) => toParamText(row.params).toLowerCase())
        .join(" | ");
      const representativePriceText = String(
        entry.representative.priceText || "",
      ).toLowerCase();
      const categorySearchText = entry.categories
        .map((category) => toPricingCategoryLabel(category).toLowerCase())
        .join(" | ");
      const rawCategorySearchText = entry.categories.join(" | ").toLowerCase();

      return (
        rawCategorySearchText.includes(search) ||
        categorySearchText.includes(search) ||
        modelName.toLowerCase().includes(search) ||
        representativeParamText.includes(search) ||
        anyParamText.includes(search) ||
        representativePriceText.includes(search)
      );
    });

    return rows.sort((left, right) =>
      compareEntries(left, right, sortKey, sortDirection),
    );
  }, [groupedRows, searchInput, selectedModel, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const pageStart = (safeCurrentPage - 1) * rowsPerPage;
  const visibleRows = filteredRows.slice(pageStart, pageStart + rowsPerPage);
  const visibleStart = filteredRows.length === 0 ? 0 : pageStart + 1;
  const visibleEnd =
    filteredRows.length === 0
      ? 0
      : Math.min(pageStart + rowsPerPage, filteredRows.length);
  const lockedCategoryLabel = resolvedLockedCategory
    ? toPricingCategoryLabel(resolvedLockedCategory)
    : null;
  const filteredModelCount = useMemo(
    () => new Set(filteredRows.map((row) => row.modelName)).size,
    [filteredRows],
  );

  const filtersDirty =
    selectedModel !== "all" ||
    searchInput.trim().length > 0 ||
    sortKey !== "priceUsd" ||
    sortDirection !== "asc" ||
    rowsPerPage !== PAGE_SIZE_OPTIONS[0] ||
    (!resolvedLockedCategory && effectiveSelectedCategory !== "all");

  const toggleExpandedRow = (rowId: string) => {
    setExpandedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const resetFilters = () => {
    setSelectedCategory("all");
    setSelectedModel("all");
    setSearchInput("");
    setSortKey("priceUsd");
    setSortDirection("asc");
    setRowsPerPage(PAGE_SIZE_OPTIONS[0]);
    setExpandedRowIds([]);
    setCurrentPage(1);
  };

  if (!snapshot || permutations.length === 0) {
    return (
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_#ffffff_0%,_var(--site-surface-0)_58%)] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary">
            <Filter className="size-3.5" />
            Pricing Snapshot
          </p>
          <h2 className="text-site-strong mt-2 font-display text-2xl uppercase tracking-[0.08em] md:text-3xl">
            Pricing Data Unavailable
          </h2>
          <p className="text-site-muted mt-3 max-w-3xl text-sm leading-6 md:text-base">
            No pricing snapshot was found in the current runtime. Run the
            pricing sync job or check D1 connectivity to populate scraped
            permutations.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-[var(--site-surface-0)] py-12 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-10 text-center">
          <Badge
            className="mb-4 gap-1.5 border-primary/20 bg-primary/5 px-3 py-1 font-medium uppercase tracking-wider text-primary"
            variant="outline"
          >
            <Clock3 className="size-3.5" />
            Pricing Snapshot
          </Badge>
          <h1 className="text-site-strong font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {lockedCategoryLabel || "Model Pricing (USD)"}
          </h1>
          <p className="text-site-muted mx-auto mt-4 max-w-2xl text-lg sm:text-xl">
            {lockedCategoryLabel
              ? `Unified pricing for ${lockedCategoryLabel} models with full parameter permutations and cost breakdowns.`
              : "Compare inference costs across the entire model catalog. One API, simple prepaid billing."}
          </p>
        </div>

        <Card className="mb-8 border-slate-200 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-site-muted">
                <Filter className="size-4" />
                Filter & Sort
              </CardTitle>
              <Button
                disabled={!filtersDirty}
                onClick={resetFilters}
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-slate-100"
              >
                <RefreshCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-site-soft">
                  Category
                </label>
                <Select
                  disabled={Boolean(resolvedLockedCategory)}
                  onValueChange={(value) => {
                    setSelectedCategory(value);
                    setSelectedModel("all");
                    setCurrentPage(1);
                  }}
                  value={effectiveSelectedCategory}
                >
                  <SelectTrigger className="w-full bg-slate-50/50">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {resolvedLockedCategory ? (
                      <SelectItem value={resolvedLockedCategory}>
                        {toPricingCategoryLabel(resolvedLockedCategory)}
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {toPricingCategoryLabel(category)}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-site-soft">
                  Model
                </label>
                <Select
                  onValueChange={(value) => {
                    setSelectedModel(value);
                    setCurrentPage(1);
                  }}
                  value={selectedModel}
                >
                  <SelectTrigger className="w-full bg-slate-50/50">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All models</SelectItem>
                    {modelOptions.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-site-soft">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-site-soft" />
                  <Input
                    className="bg-slate-50/50 pl-9"
                    onChange={(event) => {
                      const parsedSearch = pricingSearchSchema.safeParse(event.target.value)
                      setSearchInput(
                        parsedSearch.success
                          ? parsedSearch.data
                          : event.target.value.trim().slice(0, 120),
                      )
                      setCurrentPage(1);
                    }}
                    placeholder="Search model, category, params"
                    type="search"
                    value={searchInput}
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-site-soft">
                      Sort By
                    </label>
                    <Select
                      onValueChange={(value) => {
                        setSortKey(value as SortKey);
                        setCurrentPage(1);
                      }}
                      value={sortKey}
                    >
                      <SelectTrigger className="w-full bg-slate-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priceUsd">Price (USD)</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="model">Model</SelectItem>
                        <SelectItem value="credits">Credits</SelectItem>
                        <SelectItem value="scrapedAt">Updated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-site-soft">
                      Order
                    </label>
                    <Select
                      onValueChange={(value) => {
                        setSortDirection(value as SortDirection);
                        setCurrentPage(1);
                      }}
                      value={sortDirection}
                    >
                      <SelectTrigger className="w-full bg-slate-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Asc</SelectItem>
                        <SelectItem value="desc">Desc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex gap-4">
                <span className="text-xs font-medium text-site-muted">
                  <span className="text-site-strong">{filteredModelCount}</span>{" "}
                  Models
                </span>
                <span className="text-xs font-medium text-site-muted">
                  <span className="text-site-strong">{filteredRows.length}</span>{" "}
                  Permutations
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-site-soft">
                  Show
                </span>
                <Select
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                  value={String(rowsPerPage)}
                >
                  <SelectTrigger className="h-8 w-[80px] bg-slate-50/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredRows.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Search className="size-8 text-site-soft" />
            </div>
            <h3 className="text-lg font-semibold text-site-strong">
              No models found
            </h3>
            <p className="mt-1 text-sm text-site-muted">
              Try broadening your search or resetting all filters.
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={resetFilters}
              variant="outline"
            >
              <RefreshCcw className="size-4" />
              Reset All Filters
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
              <Table className="hidden md:table">
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px] text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Category
                    </TableHead>
                    <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Model
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Preview Parameters
                    </TableHead>
                    <TableHead className="w-[140px] text-right text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Price (USD)
                    </TableHead>
                    <TableHead className="w-[140px] text-right text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Credits
                    </TableHead>
                    <TableHead className="w-[160px] text-right text-[10px] font-bold uppercase tracking-widest text-site-muted">
                      Variations
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((entry) => {
                    const representative = entry.representative;
                    const totalRows = entry.rows.length;
                    const isExpanded = expandedRowIds.includes(entry.id);
                    const detailsId = `pricing-row-details-${entry.id}`;

                    return (
                      <Fragment key={entry.id}>
                        <TableRow className="group border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-4">
                            <Badge
                              variant="secondary"
                              className="bg-primary/5 text-[10px] font-bold tracking-wider text-primary transition-colors uppercase hover:bg-primary/10"
                            >
                              {entry.categorySummary || "Uncategorized"}
                            </Badge>
                            {entry.categories.length > 1 && (
                              <p className="mt-1 text-[10px] font-medium text-site-soft">
                                +{entry.categories.length - 1} more
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-sm font-semibold text-site-strong">
                            {entry.modelName}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="max-w-[300px]">
                              {entry.representativeParamText ? (
                                <p
                                  className="truncate text-xs text-slate-600"
                                  title={entry.representativeParamText}
                                >
                                  {entry.representativeParamText}
                                </p>
                              ) : (
                                <p className="text-xs text-site-soft">
                                  No extra parameters
                                </p>
                              )}
                              <p className="mt-1 text-[10px] text-site-soft">
                                Default for {entry.commonParamCount} of {totalRows}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-right font-mono text-sm font-bold text-site-strong">
                            {formatUsd(representative.priceUsd)}
                          </TableCell>
                          <TableCell className="py-4 text-right text-xs font-medium text-site-muted">
                            {formatCredits(representative.credits)}
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <Button
                              aria-controls={detailsId}
                              aria-expanded={isExpanded}
                              className="ml-auto h-8 gap-1.5 px-2 text-primary hover:no-underline"
                              onClick={() => toggleExpandedRow(entry.id)}
                              type="button"
                              variant="ghost"
                            >
                              <span className="text-xs font-semibold">
                                {`Explore ${formatCountLabel(totalRows, "row")}`}
                              </span>
                              <ArrowRight
                                className={`size-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isExpanded ? (
                          <TableRow className="border-t border-slate-100 bg-slate-50/30">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-6" id={detailsId}>
                                <Table className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                  <TableHeader className="bg-slate-50/80">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-[9px] font-bold uppercase text-site-soft">
                                        Permutation
                                      </TableHead>
                                      <TableHead className="w-[120px] text-right text-[9px] font-bold uppercase text-site-soft">
                                        Price (USD)
                                      </TableHead>
                                      <TableHead className="w-[120px] text-right text-[9px] font-bold uppercase text-site-soft">
                                        Credits
                                      </TableHead>
                                      <TableHead className="w-[80px] text-right text-[9px] font-bold uppercase text-site-soft">
                                        Action
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {entry.rows.map((row) => (
                                      <TableRow
                                        key={row.id}
                                        className="border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50"
                                      >
                                        <TableCell className="py-2.5 text-[11px] font-medium text-slate-600">
                                          {toParamText(row.params)}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right font-mono text-[11px] font-bold text-site-strong">
                                          {formatUsd(row.priceUsd)}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right text-[11px] text-site-muted">
                                          {formatCredits(row.credits)}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right">
                                          <Button
                                            className="size-6 text-site-soft transition-colors hover:text-primary"
                                            size="icon"
                                            type="button"
                                            variant="ghost"
                                          >
                                            <ArrowRight className="size-3.5" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Card List Implementation */}
              <div className="md:hidden space-y-4 p-4">
                {visibleRows.map((entry) => (
                  <Card
                    key={entry.id}
                    className="overflow-hidden border-slate-200"
                  >
                    <CardHeader className="bg-slate-50/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant="secondary"
                          className="bg-primary/5 text-[9px] font-bold tracking-wider text-primary uppercase"
                        >
                          {entry.categorySummary}
                        </Badge>
                        <span className="text-[10px] font-bold text-site-soft">
                          {formatCountLabel(entry.rows.length, "variation")}
                        </span>
                      </div>
                      <CardTitle className="text-base font-bold">
                        {entry.modelName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft mb-1">
                            Baseline Price
                          </p>
                          <p className="text-xl font-bold text-site-strong">
                            {formatUsd(entry.representative.priceUsd)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft mb-1">
                            In Credits
                          </p>
                          <p className="text-xs font-medium text-slate-600">
                            {formatCredits(entry.representative.credits)}
                          </p>
                        </div>
                      </div>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="details" className="border-none">
                          <AccordionTrigger className="py-2 text-primary font-semibold text-xs border-t border-slate-100 hover:no-underline">
                            {`View all ${formatCountLabel(entry.rows.length, "permutation")}`}
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                            <div className="space-y-2">
                              {entry.rows.map((row) => (
                                <div
                                  key={row.id}
                                  className="p-2 rounded-lg bg-slate-50/50 border border-slate-100 flex justify-between items-center text-[10px]"
                                >
                                  <span className="text-slate-600 truncate mr-4 flex-1">
                                    {toParamText(row.params)}
                                  </span>
                                  <span className="font-bold text-site-strong whitespace-nowrap">
                                    {formatUsd(row.priceUsd)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
              <p className="text-[11px] font-medium text-site-soft uppercase tracking-widest">
                Showing{" "}
                <span className="text-site-strong">
                  {visibleStart}-{visibleEnd}
                </span>{" "}
                of <span className="text-site-strong">{filteredRows.length}</span>{" "}
                models
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  disabled={safeCurrentPage <= 1}
                  onClick={() =>
                    setCurrentPage(Math.max(1, safeCurrentPage - 1))
                  }
                  size="sm"
                  variant="outline"
                  className="h-8 w-20 text-xs font-bold uppercase tracking-wider"
                >
                  Prev
                </Button>
                <div className="flex items-center gap-1 px-4">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 3 + i + 1;
                    }
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        size="icon"
                        variant={
                          safeCurrentPage === pageNum ? "default" : "ghost"
                        }
                        className="size-8 text-xs font-bold"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
                  }
                  size="sm"
                  variant="outline"
                  className="h-8 w-20 text-xs font-bold uppercase tracking-wider"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {resolvedLockedCategory ? null : (
          <div className="mt-20">
            <div className="mb-10 text-center">
              <Badge
                className="mb-4 gap-1.5 px-3 py-1 font-medium uppercase tracking-wider"
                variant="outline"
              >
                <LayoutGrid className="size-3.5" />
                Categories
              </Badge>
              <h2 className="text-site-strong font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Browse by Category
              </h2>
              <p className="text-site-muted mx-auto mt-4 max-w-2xl text-base">
                Discover specific model groups with optimized price bands for
                your specialized workloads.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categorySummary.map((summary) => (
                <Link
                  key={summary.category}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                  href={`/pricing/${toPricingCategorySlug(summary.category)}`}
                >
                  <div className="flex items-start justify-between">
                    <Badge
                      variant="secondary"
                      className="bg-primary/5 text-[10px] font-bold tracking-wider text-primary group-hover:bg-primary group-hover:text-white transition-colors uppercase px-2.5 py-0.5"
                    >
                      {toPricingCategoryLabel(summary.category)}
                    </Badge>
                    <ChevronRight className="size-4 text-site-soft transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>

                  <div className="my-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft mb-1">
                        Starting From
                      </p>
                      <p className="text-lg font-bold text-site-strong">
                        {formatUsd(summary.minPriceUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft mb-1">
                        Median Cost
                      </p>
                      <p className="text-lg font-bold text-site-strong">
                        {formatUsd(summary.medianPriceUsd)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto border-t border-slate-50 pt-4 flex items-center justify-between">
                    <div className="flex gap-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-site-muted uppercase tracking-wider">
                        <Layers className="size-3 text-site-soft" />
                        {summary.modelCount === 1 ? "1 Model" : `${summary.modelCount} Models`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-site-muted uppercase tracking-wider">
                        <LayoutGrid className="size-3 text-site-soft" />
                        {summary.rowCount === 1 ? "1 Row" : `${summary.rowCount} Rows`}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 h-1 grow scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
