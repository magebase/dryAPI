import Image from "next/image"
import { ArrowRight, BadgeCheck, CheckCircle2, PhoneCall, Quote, ShieldCheck } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { Lightning } from "@/components/site/lightning"
import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { SiteIcon } from "@/components/site/site-icon"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { HomeContent } from "@/lib/site-content-schema"

export function HomeSections({ home }: { home: HomeContent }) {
  const visibleSpotlightCards = home.spotlightCards.filter((card) => card.visible)
  const visibleCapabilityCards = home.capabilityCards.filter((card) => card.visible)
  const visibleProjectItems = home.projectShowcase.items.filter((item) => item.visible)
  const visibleResourceItems = home.resourceShowcase.items.filter((item) => item.visible)
  const trustStripCards = visibleSpotlightCards.slice(0, 3)
  const spotlightMicroProofs = ["Typical scope response: same business day", "Short and long hire terms available", "After-hours escalation available"]
  const spotlightActions = ["Talk Sales", "Check Fleet", "Request Support"]
  const capabilitySignals = [
    { label: "Generator Range", value: "5-20 kVA" },
    { label: "Support Window", value: "24/7" },
    { label: "Service Footprint", value: "National" },
  ]

  return (
    <>
      {home.hero.visible && (
        <section
          className="relative isolate -mt-[var(--site-header-height)] overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,var(--site-surface-0)_0%,var(--site-surface-1)_100%)] pt-[var(--site-header-height)]"
          data-tina-field={tinaField(home, "hero")}
        >
          <div className="absolute inset-0" data-tina-field={tinaField(home.hero, "backgroundImage")}>
            <Lightning className="opacity-100" hue={260} intensity={3.6} size={1} speed={1} xOffset={0} />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(7,14,23,0.82)_12%,rgba(8,18,28,0.42)_56%,rgba(7,15,25,0.84)_100%)]" />
          <div className="absolute inset-0 opacity-18 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute -left-28 bottom-0 h-60 w-60 rounded-full bg-[#ff8b2b]/18 blur-3xl" />
          <div className="absolute -right-24 top-20 hidden h-72 w-72 rounded-full bg-[#2f4f79]/30 blur-3xl lg:block" />
          <div className="absolute right-0 top-1/2 hidden h-72 w-52 -translate-y-1/2 bg-[linear-gradient(180deg,rgba(255,139,43,0.95),rgba(255,139,43,0.18))] [clip-path:polygon(32%_0,100%_0,68%_50%,100%_100%,32%_100%,0_50%)] lg:block" />

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 md:pb-24 md:pt-24 lg:pb-32 lg:pt-32">
            <Reveal as="div" className="text-sm uppercase tracking-[0.2em] text-[#ff9d4a]" data-tina-field={tinaField(home.hero, "kicker")}>
              {home.hero.kicker}
            </Reveal>
            <Reveal as="div" className="mt-5 max-w-3xl" delay={0.05} y={0}>
              <h1 className="text-balance font-display text-3xl uppercase leading-[1.02] tracking-[0.01em] text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:text-4xl md:text-6xl">
                <KeywordGradientText dataTinaField={tinaField(home.hero, "heading")} text={home.hero.heading} />
              </h1>
            </Reveal>
            <Reveal
              as="div"
              className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[color:var(--site-text-muted)] md:text-lg"
              delay={0.1}
              data-tina-field={tinaField(home.hero, "subheading")}
            >
              {home.hero.subheading}
            </Reveal>
            <Reveal as="div" className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4" delay={0.15}>
              <HeroAction action={home.hero.primaryAction} context="hero" field={tinaField(home.hero, "primaryAction")} />
              <div className="flex flex-wrap gap-2.5">
                <HeroAction action={home.hero.secondaryAction} context="hero" field={tinaField(home.hero, "secondaryAction")} />
                <HeroAction action={home.hero.tertiaryAction} context="hero" field={tinaField(home.hero, "tertiaryAction")} />
              </div>
            </Reveal>

            <Reveal as="div" className="mt-20 border-t border-white/12 pt-8 lg:mt-24 lg:pt-10" delay={0.2}>
              <div className="grid gap-3 md:grid-cols-3">
                {trustStripCards.map((card, index) => (
                  <Reveal
                    as="article"
                    className={`${getGradientVariant(index)} rounded-md border border-white/14 p-4 backdrop-blur md:p-5`}
                    delay={index * 0.08}
                    key={card.id}
                    revealKey={`home-trust-${card.id}`}
                    data-tina-field={tinaField(card)}
                  >
                    <SiteIcon className="size-4 text-[#ff9d4a]" icon={card.icon} />
                    <h2 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                      <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(card, "description")}>
                      {card.description}
                    </p>
                  </Reveal>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <TrustedByMarqueeSection section={home.trustedBySection} />

      {home.spotlightSection.visible && (
        <section
          className="relative border-y border-white/8 bg-[linear-gradient(180deg,var(--site-surface-1)_0%,var(--site-surface-2)_100%)] py-20"
          data-tina-field={tinaField(home, "spotlightSection")}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:100%_40px]" />
          <div className="relative mx-auto max-w-7xl px-4">
            <div className="mb-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <Reveal as="div" className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff8b2b]" data-tina-field={tinaField(home.spotlightSection, "kicker")}>
                  {home.spotlightSection.kicker}
                </p>
                <h2 className="mt-2 font-display text-3xl leading-[1.08] text-white md:text-4xl">
                  <KeywordGradientText dataTinaField={tinaField(home.spotlightSection, "title")} text={home.spotlightSection.title} />
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--site-text-muted)] md:text-base">
                  Straightforward service lines for teams that need clear answers quickly. No inflated claims, just practical power planning and delivery.
                </p>
              </Reveal>

              <Reveal as="div" className={`${getGradientVariant(0)} border border-white/12 p-4`} delay={0.08}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff9d4a]">At A Glance</p>
                <div className="mt-3 grid gap-2">
                  {capabilitySignals.map((signal) => (
                    <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/10 pb-2 last:border-b-0 last:pb-0" key={signal.label}>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{signal.label}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white">{signal.value}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {visibleSpotlightCards.map((card, index) => (
                <Reveal
                  as="article"
                  className={`${getGradientVariant(index + 1)} group border border-white/14 px-6 py-7 transition duration-300 hover:border-[#ff8b2b]/55`}
                  delay={index * 0.08}
                  key={card.id}
                  data-tina-field={tinaField(card)}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="inline-flex size-10 items-center justify-center border border-white/12 bg-[#172434]">
                      <SiteIcon className="size-5 text-slate-100 transition group-hover:text-[#ff9d4a]" icon={card.icon} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-white">
                    <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(card, "description")}>
                    {card.description}
                  </p>
                  <div className={`${getGradientVariant(index + 2)} mt-5 border border-white/12 px-3 py-2`}>
                    <p className="text-[10px] uppercase tracking-[0.17em] text-[#ffb67f]">Field Note</p>
                    <p className="mt-1 text-xs text-slate-100">{spotlightMicroProofs[index] ?? spotlightMicroProofs[0]}</p>
                  </div>
                  <QuoteAwareLink
                    className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff9d4a] transition hover:text-white"
                    href={card.title.toLowerCase().includes("support") ? home.contactPanel.primaryAction.href : card.title.toLowerCase().includes("rental") ? home.hero.secondaryAction.href : home.hero.primaryAction.href}
                    quoteLabel={spotlightActions[index] ?? "Start Scope Call"}
                  >
                    {spotlightActions[index] ?? "Start Scope Call"}
                    <ArrowRight aria-hidden className="size-3" />
                  </QuoteAwareLink>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {home.capabilitySection.visible && (
        <section
          className="relative border-b border-white/8 bg-[linear-gradient(180deg,var(--site-surface-2)_0%,var(--site-surface-3)_100%)] py-20"
          data-tina-field={tinaField(home, "capabilitySection")}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_100%]" />
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-9 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <Reveal as="div">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff8b2b]" data-tina-field={tinaField(home.capabilitySection, "kicker")}>
                  {home.capabilitySection.kicker}
                </p>
                <h2 className="mt-2 font-display text-3xl leading-[1.08] text-white md:text-4xl">
                  <KeywordGradientText dataTinaField={tinaField(home.capabilitySection, "title")} text={home.capabilitySection.title} />
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[color:var(--site-text-muted)] md:text-base">
                  One partner from specification through support. Every capability below is designed to reduce delay, protect output, and keep decisions simple.
                </p>
              </Reveal>

              <Reveal as="div" className={`${getGradientVariant(2)} border border-white/12 p-4`} delay={0.08}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb67f]">What You Get</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    "Clear scope",
                    "Predictable delivery",
                    "Real support",
                  ].map((signal, index) => (
                    <Reveal as="div" className={`${getGradientVariant(index)} border border-white/10 px-2.5 py-2`} delay={0.12 + index * 0.05} key={signal} y={0}>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-200">{signal}</p>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCapabilityCards.map((card, index) => (
                <Reveal
                  as="article"
                  className={`${getGradientVariant(index + 2)} group relative overflow-hidden border border-white/10 px-5 py-6 transition duration-300 hover:border-[#ff8b2b]/55`}
                  delay={index * 0.08}
                  key={card.id}
                  data-tina-field={tinaField(card)}
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,rgba(255,157,74,0.95)_0%,rgba(255,157,74,0.25)_100%)]" />
                  <div className="flex items-start gap-3 pl-1">
                    <div className="inline-flex size-9 shrink-0 items-center justify-center border border-white/12 bg-[#172434]">
                      <SiteIcon className="size-4 text-[#ff8b2b]" icon={card.icon} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Capability {String(index + 1).padStart(2, "0")}</p>
                      <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white">
                        <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                      </h3>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(card, "description")}>
                    {card.description}
                  </p>
                </Reveal>
              ))}
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "Design Confidence",
                  body: "Clear recommendations based on load profile, compliance risk, and practical site access.",
                },
                {
                  title: "Delivery Discipline",
                  body: "Structured mobilisation and commissioning workflows that reduce rework and surprise downtime.",
                },
                {
                  title: "Support Readiness",
                  body: "Escalation paths that stay active after hours, so your project is never left waiting.",
                },
              ].map((item, index) => (
                <Reveal as="div" className={`${getGradientVariant(index + 1)} border border-white/10 px-4 py-3`} delay={index * 0.08} key={item.title} y={0}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff9d4a]">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-text-muted)]">{item.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <OperationalProofSection
        capabilityCards={visibleCapabilityCards}
        home={home}
        stories={[...visibleProjectItems.slice(0, 2), ...visibleResourceItems.slice(0, 2)]}
      />

      <PlanningSplitSection home={home} trustCards={trustStripCards} />

      <TestimonialsMarqueeSection section={home.testimonialsSection} />

      <ShowcaseSection section={home.projectShowcase} />
      <ShowcaseSection section={home.resourceShowcase} />

      <CommandCtaSection home={home} />

      {home.contactPanel.visible && (
        <Reveal className="mx-auto max-w-7xl px-4 py-10 md:py-14" data-tina-field={tinaField(home, "contactPanel")}>
          <div className={`${getGradientVariant(1)} rounded-md border border-white/10 px-6 py-6 md:flex md:items-center md:justify-between md:gap-8`}>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#ff8b2b]" data-tina-field={tinaField(home.contactPanel, "kicker")}>
                {home.contactPanel.kicker}
              </p>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.04em] text-white">
                <KeywordGradientText dataTinaField={tinaField(home.contactPanel, "heading")} text={home.contactPanel.heading} />
              </h2>
              <p className="mt-2 text-sm text-slate-300 md:text-base" data-tina-field={tinaField(home.contactPanel, "body")}>
                {home.contactPanel.body}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
              <HeroAction action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} />
              <HeroAction action={home.contactPanel.secondaryAction} field={tinaField(home.contactPanel, "secondaryAction")} />
            </div>
          </div>
        </Reveal>
      )}
    </>
  )
}

type ShowcaseItem = HomeContent["projectShowcase"]["items"][number]
type IconCard = HomeContent["capabilityCards"][number]
type TestimonialItem = HomeContent["testimonialsSection"]["items"][number]
type TrustedLogoItem = HomeContent["trustedBySection"]["logos"][number]

function OperationalProofSection({
  capabilityCards,
  home,
  stories,
}: {
  capabilityCards: IconCard[]
  home: HomeContent
  stories: ShowcaseItem[]
}) {
  if (!stories.length || !capabilityCards.length) {
    return null
  }

  return (
    <section className="bg-[linear-gradient(180deg,var(--site-surface-1)_0%,var(--site-surface-2)_100%)] py-20" data-tina-field={tinaField(home, "projectShowcase")}>
      <div className="mx-auto max-w-7xl px-4">
        <Reveal as="div" className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff8b2b]">Operational Proof</p>
          <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.05em] text-white md:text-4xl">
            <KeywordGradientText text="Real Deployments, Practical Guidance, Faster Decisions" />
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[color:var(--site-text-muted)] md:text-lg">
            High-trust power projects are won with proof, not promises. These project snapshots and field guides show how GenFix teams plan, deliver,
            and support critical power outcomes.
          </p>
        </Reveal>

        <div className="mt-12 space-y-8">
          {stories.map((item, index) => {
            const storyHighlights = [0, 1, 2].map((offset) => capabilityCards[(index + offset) % capabilityCards.length])

            return (
              <Reveal
                as="article"
                className={`${getGradientVariant(index)} overflow-hidden rounded-md border border-white/10 shadow-[0_20px_38px_rgba(0,0,0,0.28)]`}
                delay={index * 0.08}
                key={item.id}
                data-tina-field={tinaField(item)}
              >
                <div className="grid lg:grid-cols-2">
                  <div className={`relative ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                    <Image
                      alt={item.title}
                      className="h-full min-h-[280px] w-full object-cover"
                      data-tina-field={tinaField(item, "image")}
                      height={720}
                      src={item.image}
                      width={1080}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(7,13,22,0.55)_100%)]" />
                  </div>

                  <div className="p-7 md:p-9">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff9d4a]" data-tina-field={tinaField(item, "tag")}>
                      {item.tag} / Trusted Delivery
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-white">
                      <KeywordGradientText dataTinaField={tinaField(item, "title")} text={item.title} />
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(item, "summary")}>
                      {item.summary}
                    </p>

                    <div className="mt-6 grid gap-3">
                      {storyHighlights.map((highlight, highlightIndex) => (
                        <Reveal
                          as="div"
                          className={`${getGradientVariant(highlightIndex)} flex items-start gap-2.5 rounded-sm border border-white/10 px-3 py-2`}
                          delay={0.04 * (highlightIndex + 1)}
                          key={`${item.id}-${highlight.id}`}
                          data-tina-field={tinaField(highlight)}
                          y={0}
                        >
                          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-[#ff9d4a]" />
                          <p className="text-sm text-slate-200">
                            <span className="font-semibold text-white">
                              <KeywordGradientText dataTinaField={tinaField(highlight, "title")} text={`${highlight.title}:`} />
                            </span>{" "}
                            <span className="text-[color:var(--site-text-muted)]" data-tina-field={tinaField(highlight, "description")}>
                              {highlight.description}
                            </span>
                          </p>
                        </Reveal>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <QuoteAwareLink
                        className="inline-flex items-center gap-2 rounded-sm bg-[#ff8b2b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#ff7f19]"
                        data-tina-field={tinaField(item, "href")}
                        href={item.href}
                        quoteLabel={item.title}
                      >
                        Explore Story
                        <ArrowRight aria-hidden className="size-3.5" />
                      </QuoteAwareLink>
                      <HeroAction action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} />
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PlanningSplitSection({
  home,
  trustCards,
}: {
  home: HomeContent
  trustCards: HomeContent["spotlightCards"]
}) {
  const featureImage = home.resourceShowcase.items.find((item) => item.visible)?.image ?? home.hero.backgroundImage

  return (
    <section className="bg-[linear-gradient(180deg,var(--site-surface-2)_0%,var(--site-surface-3)_100%)] py-20" data-tina-field={tinaField(home, "contactPanel")}>
      <Reveal
        as="div"
        className={`${getGradientVariant(3)} mx-auto grid max-w-7xl gap-0 overflow-hidden rounded-md border border-white/10 shadow-[0_22px_44px_rgba(0,0,0,0.28)] lg:grid-cols-2`}
      >
        <div className="relative min-h-[320px]" data-tina-field={tinaField(home.hero, "backgroundImage")}>
          <Image alt="GenFix field planning" className="h-full w-full object-cover" height={900} src={featureImage} width={1200} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,16,0.25)_0%,rgba(8,15,24,0.76)_100%)]" />
          <div className="absolute bottom-5 left-5 right-5 rounded-sm border border-white/14 bg-[#0f1f31]/86 p-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff9d4a]">Response Discipline</p>
            <p className="mt-2 text-sm text-slate-200">
              From first call to handover, your plan is shaped around uptime, straightforward communication, and fast site-readiness.
            </p>
          </div>
        </div>

        <div className="p-7 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff8b2b]">High Trust Planning</p>
          <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.05em] text-white md:text-4xl">
            <KeywordGradientText text="One Team Across Sales, Hire, Service, and Support" />
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(home.contactPanel, "body")}>
            {home.contactPanel.body} We combine product guidance, hire flexibility, and support planning so your team can lock in power decisions with
            confidence.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {trustCards.map((card, index) => (
              <Reveal
                as="div"
                className={`${getGradientVariant(index + 1)} rounded-sm border border-white/10 p-3`}
                delay={index * 0.08}
                key={card.id}
                data-tina-field={tinaField(card)}
                y={0}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(card, "description")}>
                  {card.description}
                </p>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <HeroAction action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} />
            <HeroAction action={home.hero.secondaryAction} field={tinaField(home.hero, "secondaryAction")} />
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function TestimonialsMarqueeSection({ section }: { section: HomeContent["testimonialsSection"] }) {
  if (!section.visible || !section.items.length) {
    return null
  }

  const marqueeItems: TestimonialItem[] = [...section.items, ...section.items]

  return (
    <section className="relative border-y border-white/10 bg-[#101d2e] py-16" data-tina-field={tinaField(section)}>
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,157,74,0.22)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto max-w-7xl px-4">
        <Reveal as="div" className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9d4a]" data-tina-field={tinaField(section, "kicker")}>
            {section.kicker}
          </p>
          <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.05em] text-white md:text-4xl">
            <KeywordGradientText dataTinaField={tinaField(section, "title")} text={section.title} />
          </h2>
        </Reveal>
      </div>

      <div className="relative left-1/2 mt-9 w-screen -translate-x-1/2 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-[linear-gradient(90deg,#101d2e_0%,rgba(16,29,46,0)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(270deg,#101d2e_0%,rgba(16,29,46,0)_100%)]" />
        <ul className="marquee-track flex w-max gap-4 px-4 sm:px-6 lg:px-10 [--marquee-duration:62s]">
          {marqueeItems.map((item, index) => (
            <li
              className={`${getGradientVariant(index)} w-[20rem] shrink-0 rounded-md border border-white/12 px-5 py-5 shadow-[0_14px_30px_rgba(0,0,0,0.24)] sm:w-[24rem]`}
              data-tina-field={tinaField(item)}
              key={`${item.id}-${index}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb67f]" data-tina-field={tinaField(item, "company")}>
                  {item.company}
                </p>
                <Quote aria-hidden className="size-4 text-[#ff9d4a]" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-200" data-tina-field={tinaField(item, "quote")}>
                {item.quote}
              </p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                <div>
                  <p className="text-sm font-semibold text-white" data-tina-field={tinaField(item, "person")}>
                    {item.person}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300" data-tina-field={tinaField(item, "role")}>
                    {item.role}
                  </p>
                </div>
                {item.metric ? (
                  <span className="rounded-full border border-[#ff9d4a]/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffc998]" data-tina-field={tinaField(item, "metric")}>
                    {item.metric}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function TrustedByMarqueeSection({ section }: { section: HomeContent["trustedBySection"] }) {
  if (!section.visible || !section.logos.length) {
    return null
  }

  const marqueeItems: TrustedLogoItem[] = [...section.logos, ...section.logos, ...section.logos]

  return (
    <section className="relative border-b border-white/8 bg-[#182739] py-12" data-tina-field={tinaField(section)}>
      <div className="mx-auto max-w-7xl px-4">
        <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9d4a]" data-tina-field={tinaField(section, "kicker")}>
              {section.kicker}
            </p>
            <h2 className="mt-2 text-xl font-semibold uppercase tracking-[0.08em] text-white sm:text-2xl" data-tina-field={tinaField(section, "title")}>
              {section.title}
            </h2>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Infinite partner band</p>
        </Reveal>
      </div>

      <div className="relative left-1/2 mt-7 w-screen -translate-x-1/2 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-[linear-gradient(90deg,#182739_0%,rgba(24,39,57,0)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-[linear-gradient(270deg,#182739_0%,rgba(24,39,57,0)_100%)]" />
        <div className="marquee-track marquee-track-reverse flex w-max items-center gap-3 px-4 sm:px-6 lg:px-10 [--marquee-duration:34s]">
          {marqueeItems.map((logo, index) => (
            <div
              className="flex shrink-0 items-center gap-3 rounded-full border border-white/15 bg-white/6 px-4 py-2.5 backdrop-blur"
              data-tina-field={tinaField(logo)}
              key={`${logo.id}-${index}`}
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#ff9d4a] text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f1b2b]" data-tina-field={tinaField(logo, "abbreviation")}>
                {logo.abbreviation}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-100" data-tina-field={tinaField(logo, "name")}>
                {logo.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CommandCtaSection({ home }: { home: HomeContent }) {
  return (
    <section className="bg-[linear-gradient(180deg,var(--site-surface-1)_0%,var(--site-surface-2)_100%)] py-16" data-tina-field={tinaField(home, "hero")}>
      <div className="mx-auto max-w-7xl px-4">
        <Reveal
          as="div"
          className={`${getGradientVariant(4)} rounded-md border border-[#ff9d4a]/30 px-6 py-8 shadow-[0_16px_34px_rgba(0,0,0,0.26)] md:px-10 md:py-10`}
        >
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr] lg:items-center">
            <Reveal as="div" y={0}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9d4a]">Immediate Next Step</p>
              <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.05em] text-white md:text-4xl">
                <KeywordGradientText text="Start With A Fast Scope Call, Leave With A Clear Power Plan" />
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[color:var(--site-text-muted)]" data-tina-field={tinaField(home.hero, "subheading")}>
                {home.hero.subheading} Talk to a specialist and get a practical recommendation for sizing, timeline, and on-site support options.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <HeroAction action={home.hero.primaryAction} field={tinaField(home.hero, "primaryAction")} />
                <HeroAction action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} />
              </div>
            </Reveal>

            <div className="grid gap-3">
              <Reveal as="div" y={0}>
                <TrustSnippet
                  icon={ShieldCheck}
                  title="Transparent Technical Advice"
                  body="Clear options around duty cycle, runtime, and compliance so project teams can decide quickly."
                />
              </Reveal>
              <Reveal as="div" delay={0.08} y={0}>
                <TrustSnippet
                  icon={BadgeCheck}
                  title="Field-Tested Delivery Workflow"
                  body="Sales, rental, and support teams stay coordinated from quote through commissioning and handover."
                />
              </Reveal>
              <Reveal as="div" delay={0.16} y={0}>
                <TrustSnippet
                  icon={PhoneCall}
                  title="Fast Escalation Path"
                  body="When conditions shift on site, your team has a direct route to practical support and backup actions."
                />
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function TrustSnippet({
  body,
  icon: Icon,
  title,
}: {
  body: string
  icon: typeof ShieldCheck
  title: string
}) {
  return (
    <div className={`${getGradientVariant(2)} rounded-sm border border-white/12 px-4 py-3`}>
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-[#ff9d4a]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
            <KeywordGradientText text={title} />
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--site-text-muted)]">{body}</p>
        </div>
      </div>
    </div>
  )
}

function HeroAction({
  action,
  context = "default",
  field,
}: {
  action: { label: string; href: string; style: "solid" | "outline" | "ghost" }
  context?: "hero" | "default"
  field: string
}) {
  const className =
    context === "hero"
      ? action.style === "solid"
        ? "group inline-flex items-center gap-2 rounded-md bg-[linear-gradient(135deg,#ff9d4a_0%,#ff7426_100%)] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_16px_34px_rgba(255,130,32,0.36)] ring-1 ring-[#ffd6ae]/35 transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
        : action.style === "outline"
          ? "rounded-sm border border-[#ff9d4a]/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffb67f] transition hover:bg-[#ff8b2b]/18 hover:text-white"
          : "rounded-sm border border-white/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-white/70 hover:text-white"
      : action.style === "solid"
        ? "bg-[#ff8b2b] text-white hover:bg-[#ff7f19]"
        : action.style === "outline"
          ? "border border-[#ff8b2b] text-[#ff8b2b] hover:bg-[#ff8b2b] hover:text-white"
          : "border border-white/20 text-slate-200 hover:border-white hover:text-white"

  const baseClassName =
    context === "hero"
      ? `w-full justify-center transition sm:w-auto ${className}`
      : `rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${className}`

  return (
    <QuoteAwareLink
      className={baseClassName}
      data-tina-field={field}
      href={action.href}
      quoteLabel={action.label}
    >
      {action.label}
      {context === "hero" && action.style === "solid" ? (
        <ArrowRight aria-hidden className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      ) : null}
    </QuoteAwareLink>
  )
}

function ShowcaseSection({
  section,
}: {
  section: HomeContent["projectShowcase"] | HomeContent["resourceShowcase"]
}) {
  if (!section.visible) {
    return null
  }

  const visibleItems = section.items.filter((item) => item.visible)
  const leadSummary = visibleItems[0]?.summary

  return (
    <section
      className="bg-[linear-gradient(180deg,var(--site-surface-3)_0%,var(--site-surface-2)_100%)] py-16 even:bg-[linear-gradient(180deg,var(--site-surface-2)_0%,var(--site-surface-3)_100%)]"
      data-tina-field={tinaField(section)}
    >
      <div className="mx-auto max-w-7xl px-4">
        <Reveal as="div" className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-100">
              <KeywordGradientText dataTinaField={tinaField(section, "title")} text={section.title} />
            </h2>
              {leadSummary ? <p className="mt-3 text-sm leading-relaxed text-[color:var(--site-text-muted)]">{leadSummary}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <QuoteAwareLink
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9d4a] transition hover:text-white"
              data-tina-field={tinaField(section, "ctaHref")}
              href={section.ctaHref}
              quoteLabel={section.ctaLabel}
            >
              <span data-tina-field={tinaField(section, "ctaLabel")}>{section.ctaLabel}</span>
            </QuoteAwareLink>
            <QuoteAwareLink
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:text-[#ff9d4a]"
              href="/contact"
              quoteLabel="Request A Quote"
            >
              Request A Quote /
            </QuoteAwareLink>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {visibleItems.map((item, index) => (
            <Reveal
              as="article"
              className={`${getGradientVariant(index)} group overflow-hidden rounded-md border border-white/10 transition duration-300 hover:-translate-y-1 hover:border-[#ff8b2b]/55`}
              delay={index * 0.08}
              key={item.id}
              data-tina-field={tinaField(item)}
            >
              <div className="relative overflow-hidden">
                <Image
                  alt={item.title}
                  className="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
                  data-tina-field={tinaField(item, "image")}
                  height={520}
                  src={item.image}
                  width={680}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(8,15,24,0.55)_100%)]" />
              </div>
              <div className="space-y-3 px-4 py-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff8b2b]" data-tina-field={tinaField(item, "tag")}>
                  {item.tag}
                </p>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                  <KeywordGradientText dataTinaField={tinaField(item, "title")} text={item.title} />
                </h3>
                  <p className="text-sm leading-relaxed text-[color:var(--site-text-soft)]" data-tina-field={tinaField(item, "summary")}>
                  {item.summary}
                </p>

                {item.galleryImages?.length ? (
                  <div className="grid grid-cols-3 gap-2" data-tina-field={tinaField(item, "galleryImages")}>
                    {item.galleryImages.slice(0, 3).map((image) => (
                      <Image
                        key={`${item.id}-${image.id}`}
                        alt={image.alt || item.title}
                        className="h-14 w-full rounded-sm border border-white/15 object-cover"
                        data-tina-field={tinaField(image, "src")}
                        height={120}
                        src={image.src}
                        width={180}
                      />
                    ))}
                  </div>
                ) : null}

                <QuoteAwareLink
                  className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition group-hover:text-[#ff9d4a]"
                  data-tina-field={tinaField(item, "href")}
                  href={item.href}
                >
                  Read More /
                </QuoteAwareLink>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
