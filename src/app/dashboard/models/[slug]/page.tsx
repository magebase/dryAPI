import { notFound } from "next/navigation"
import {
  type LucideIcon,
  Image as ImageGlyph,
  Layers2,
  Mic,
  Music,
  TerminalSquare,
  Video,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { findModelCategory } from "@/components/site/dashboard/model-categories"

const categoryIconMap: Record<string, LucideIcon> = {
  "text-to-image": ImageGlyph,
  "text-to-speech": Mic,
  "video-to-text": Video,
  "image-to-text": TerminalSquare,
  "image-to-video": Video,
  "text-to-video": Video,
  "text-to-embedding": Layers2,
  "image-to-image": ImageGlyph,
  "text-to-music": Music,
  "background-removal": TerminalSquare,
}

type DashboardModelCategoryPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function DashboardModelCategoryPage({
  params,
}: DashboardModelCategoryPageProps) {
  const { slug } = await params
  const modelCategory = findModelCategory(slug)

  if (!modelCategory) {
    notFound()
  }

  const CategoryIcon = categoryIconMap[modelCategory.slug] ?? Layers2

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <CategoryIcon className="size-5" />
            <span>{modelCategory.label}</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            {modelCategory.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-6 text-sm text-zinc-700 dark:text-zinc-200">
          <p>
            This panel is ready for live model inventory, latency metrics, and pricing per call.
            Connect it to your model catalog API to display provider availability and recommended routing tiers.
          </p>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="inline-flex items-center gap-2 font-semibold">
              <CategoryIcon className="size-4" />
              <span>Suggested next integration</span>
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">
              Fetch `/api/v1/models` and hydrate this view with active endpoints, throughput limits, and estimated credit cost.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
