import Image from "next/image"
import { tinaField } from "tinacms/dist/react"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { RoutePage } from "@/lib/site-content-schema"

type RoutePageElement = NonNullable<RoutePage["pageContent"]>["elements"][number]

type RoutePageElementsProps = {
  elements: RoutePageElement[]
}

export function RoutePageElements({ elements }: RoutePageElementsProps) {
  if (!elements.length) {
    return null
  }

  return (
    <section className="border-b border-slate-200 bg-[var(--site-surface-0)] py-8 md:py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 md:gap-6">
        {elements.map((element, index) => (
          <Reveal as="div" key={element.id} delay={index * 0.06} data-tina-field={tinaField(element)}>
            <PageElement element={element} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function PageElement({ element }: { element: RoutePageElement }) {
  switch (element.type) {
    case "heading":
      return (
        <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-slate-900 sm:text-3xl md:text-4xl">
          <KeywordGradientText dataTinaField={tinaField(element, "text")} text={element.text ?? ""} />
        </h2>
      )

    case "paragraph":
      return (
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base" data-tina-field={tinaField(element, "text")}>
          {element.text}
        </p>
      )

    case "link":
      if (!element.href) {
        return null
      }

      return (
        <QuoteAwareLink
          className="inline-block text-xs font-semibold uppercase tracking-[0.16em] text-primary"
          data-tina-field={tinaField(element, "href")}
          href={element.href}
          quoteLabel={element.text}
        >
          {element.text}
        </QuoteAwareLink>
      )

    case "image":
      if (!element.src) {
        return null
      }

      return (
        <Image
          alt={element.text || "Page content image"}
          className="w-full max-w-4xl rounded-md border border-slate-200 object-cover"
          data-tina-field={tinaField(element, "src")}
          height={900}
          src={element.src}
          width={1600}
        />
      )

    case "custom":
      return (
        <div
          className={`${getGradientVariant(2)} rounded-md border border-slate-200 p-4 text-sm text-slate-700`}
          data-tina-field={tinaField(element, "text")}
        >
          {element.text || "Custom element"}
        </div>
      )

    default:
      return null
  }
}
