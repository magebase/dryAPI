import Link from "next/link"
import {
  ArrowRight,
  type LucideIcon,
  Image as ImageGlyph,
  Layers2,
  Mic,
  Music,
  TerminalSquare,
  Video,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { modelCategories } from "@/components/site/dashboard/model-categories"

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

export default function DashboardModelsPage() {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Layers2 className="size-5" />
            <span>All Models</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Browse dryAPI model families and jump into each capability view.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modelCategories.map((category) => {
          const CategoryIcon = categoryIconMap[category.slug] ?? Layers2

          return (
            <Link key={category.slug} href={`/dashboard/models/${category.slug}`}>
              <Card className="h-full border-zinc-200 bg-white/95 py-5 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600">
                <CardHeader className="gap-2 px-5">
                  <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
                    <CategoryIcon className="size-4" />
                    <span>{category.label}</span>
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-300">{category.summary}</CardDescription>
                </CardHeader>
                <CardContent className="inline-flex items-center gap-2 px-5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <span>View category</span>
                  <ArrowRight className="size-4" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
