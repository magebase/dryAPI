import Image from "next/image"
import Link from "next/link"
import { tinaField } from "tinacms/dist/react"

import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"

export function PlaygroundPageTemplate({ page, site }: { page: RoutePage; site: SiteConfig }) {
  const categories = [
    { href: "/playground/text-to-image", label: "Text → Image" },
    { href: "/playground/image-to-image", label: "Image → Image" },
    { href: "/playground/image-to-text", label: "Image → Text" },
    { href: "/playground/image-to-video", label: "Image → Video" },
    { href: "/playground/text-to-speech", label: "Text → Speech" },
    { href: "/playground/text-to-music", label: "Text → Music" },
    { href: "/playground/video-to-text", label: "Video → Text" },
  ]

  return (
    <main className="min-h-screen bg-[#0b0a0b] text-[color:var(--site-text-strong)]">
      <section className="relative isolate overflow-hidden border-b border-white/6">
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover opacity-12"
          height={800}
          priority
          src={page.hero.image}
          width={1600}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b05]/95 via-[#1f0f08]/86 to-[#0b0a0b]/80" />

        <Reveal as="div" className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          <p className="text-sm uppercase tracking-[0.22em] text-primary" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl uppercase leading-tight tracking-[0.03em] text-white md:text-6xl" data-tina-field={tinaField(page.hero, "heading")}>
            {page.hero.heading}
          </h1>
          <p className="mt-5 max-w-2xl text-sm text-slate-300 sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <aside className="md:col-span-3">
            <div className="sticky top-24 rounded-md border border-white/8 bg-gradient-to-b from-[#0e0b0b]/60 to-[#0b0a0b]/40 p-4">
              <h4 className="text-xs uppercase tracking-[0.18em] text-slate-300">Categories</h4>
              <ul className="mt-4 space-y-2">
                {categories.map((c) => (
                  <li key={c.href}>
                    <Link
                      className="block rounded-sm px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/3"
                      href={c.href}
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="md:col-span-7">
            <div className="rounded-md border border-white/8 bg-[#0f0e10] p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-sm bg-gradient-to-br from-[#ff6b35] to-[#c14dd6]" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-300">FLUX.2 Klein 4B BF16</p>
                    <p className="text-sm font-semibold text-white">Image to Image</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="rounded-sm bg-white/6 px-3 py-1 text-xs text-slate-200">Preview</button>
                  <button className="rounded-sm bg-transparent px-3 py-1 text-xs text-slate-300">JSON</button>
                  <button className="rounded-sm bg-transparent px-3 py-1 text-xs text-slate-300">cURL</button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-sm border border-white/8 bg-[#0b0b0c] p-2">
                  <div className="relative aspect-video w-full overflow-hidden rounded-sm">
                    <Image src={page.hero.image} alt="preview" fill className="object-cover" />
                    <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/20" />
                  </div>
                </div>

                <div className="rounded-sm border border-white/8 bg-[#0b0b0c] p-3">
                  <textarea
                    className="h-full w-full resize-none bg-transparent text-sm text-slate-200 placeholder:text-slate-400"
                    defaultValue={"Apply cinematic color grading with warm highlights and cool shadows, enhance texture details and add soft atmospheric lighting."}
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-400">Image size: 1024x768 • Steps: 28</div>
                    <div className="flex items-center gap-2">
                      <button className="rounded-sm bg-white/6 px-3 py-2 text-xs text-slate-200">Sample Image</button>
                      <button className="rounded-sm bg-gradient-to-r from-[#ff6b35] to-[#c14dd6] px-3 py-2 text-xs font-semibold text-white">Generate</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="md:col-span-2">
            <div className="rounded-md border border-white/8 bg-gradient-to-b from-[#0e0e10]/50 to-[#0b0a0b]/30 p-4">
              <h4 className="text-xs uppercase tracking-[0.18em] text-slate-300">Quick Tips</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Use specific style tokens (e.g., "photorealistic, soft shadows").</li>
                <li>Pin a model to stabilize outputs across runs.</li>
                <li>Inspect JSON tab for payload shape and costs.</li>
              </ul>
              <div className="mt-4">
                <QuoteAwareLink href="/docs" className="text-xs text-primary">Read integration docs</QuoteAwareLink>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
