import Image from "next/image"
import { ArrowRight, Mail, MessageSquare, ShieldCheck, TerminalSquare } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { SiteIcon } from "@/components/site/site-icon"
import type { HomeContent, SiteConfig } from "@/lib/site-content-schema"
import { Lightning } from "./lightning"

type HomeAction = HomeContent["hero"]["primaryAction"]

export function HomeSections({ home, site }: { home: HomeContent; site: SiteConfig }) {
  const spotlightCards = home.spotlightCards.filter((card) => card.visible).slice(0, 3)
  const capabilityCards = home.capabilityCards.filter((card) => card.visible)
  const valueCards = capabilityCards.slice(0, 3)
  const stories = home.projectShowcase.items.filter((item) => item.visible).slice(0, 3)
  const workflowStory = stories[0]
  const resourcePreview = home.resourceShowcase.items.find((item) => item.visible)
  const trustedLogos = home.trustedBySection.logos.slice(0, 8)
  const trustedMarqueeLogos = [...trustedLogos, ...trustedLogos, ...trustedLogos]
  const testimonial = home.testimonialsSection.items[0]

  const capabilitySignals = [
    {
      label: resolveSiteUiText(site, "home.capabilitySignal.label.1", "Model Classes"),
      value: resolveSiteUiText(site, "home.capabilitySignal.value.1", "Chat / Image / Audio / Embeddings"),
    },
    {
      label: resolveSiteUiText(site, "home.capabilitySignal.label.2", "Support Window"),
      value: resolveSiteUiText(site, "home.capabilitySignal.value.2", "24/7"),
    },
    {
      label: resolveSiteUiText(site, "home.capabilitySignal.label.3", "Deployment Scope"),
      value: resolveSiteUiText(site, "home.capabilitySignal.value.3", "Global"),
    },
  ]

  const spotlightAction1 = resolveSiteUiText(site, "home.spotlightAction.1", "Review API")
  const spotlightAction2 = resolveSiteUiText(site, "home.spotlightAction.2", "Check Models")
  const spotlightAction3 = resolveSiteUiText(site, "home.spotlightAction.3", "Configure Guardrails")

  const operationalHeading = resolveSiteUiText(
    site,
    "home.operationalProof.heading",
    "Production Patterns That Hold Up Under Load"
  )
  const operationalBody = resolveSiteUiText(
    site,
    "home.operationalProof.body",
    "High-performing AI products are built on measurable routing, predictable billing, and reliable response contracts."
  )

  const planningHeading = resolveSiteUiText(
    site,
    "home.planning.heading",
    "One Team Across Routing, Billing, And Reliability"
  )
  const planningBody = resolveSiteUiText(
    site,
    "home.planning.bodySuffix",
    "Combine model flexibility with governance controls so product and platform teams can ship confidently."
  )

  const commandHeading = resolveSiteUiText(
    site,
    "home.commandCta.heading",
    "Start Fast With A Gateway Built For Production AI"
  )
  const commandBody = resolveSiteUiText(
    site,
    "home.commandCta.bodySuffix",
    "Talk to our team for implementation guidance, endpoint planning, and pricing fit for your workload."
  )

  const supportPrompt = resolveSiteUiText(
    site,
    "footer.supportPrompt",
    "Need Help With API Rollout, Pricing, Or Reliability?"
  )

  const requestSample = `POST /api/v1/inference\n{\n  "model": "openai/gpt-4.1-mini",\n  "input": "Summarize this incident timeline",\n  "type": "text"\n}`
  const responseSample = `HTTP 200\n{\n  "id": "inf_82dk1",\n  "status": "ok",\n  "provider": "runpod",\n  "usage_cost": 0.0021,\n  "latency_ms": 412\n}`

  const heroMediaImage = workflowStory?.image ?? home.hero.backgroundImage

  const omnichannelTiles = [
    {
      title: "Chat",
      body: "Support assistants and agent workflows with unified auth and request limits.",
      icon: MessageSquare,
    },
    {
      title: "Email",
      body: "Run summarization and classification reliably for inbound and outbound flows.",
      icon: Mail,
    },
    {
      title: "Documents",
      body: "Apply embeddings and extraction pipelines with deterministic contracts.",
      icon: ShieldCheck,
    },
    {
      title: "Automation",
      body: "Connect n8n and orchestration tools to one API instead of many provider SDKs.",
      icon: TerminalSquare,
    },
  ]

  const frameworkCells = [
    { label: "Compose", body: "Define your request once" },
    { label: "Guard", body: "Enforce auth and cost" },
    { label: "Command", body: "Control all routing" },
  ]

  return (
    <>
      {home.hero.visible ? (
        <section
          className="-mt-[var(--site-header-height)] bg-[color:var(--site-surface-0)] pb-10 pt-[var(--site-header-height)] md:pb-14"
          data-tina-field={tinaField(home, "hero")}
        >
          <div className="mx-auto max-w-7xl px-4 pt-6 md:pt-8">
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <Lightning className="opacity-100" hue={260} />
            </div>
            <Reveal
              as="div"
              className="relative overflow-hidden rounded-[28px] border border-[#f3b08d] bg-[linear-gradient(125deg,#f45f35_0%,#ef6a38_22%,#f68d58_50%,#f6ba97_74%,#f7d2b9_100%)] px-6 pb-8 pt-7 md:px-12 md:pb-12 md:pt-11"
            >
              <div className="pointer-events-none absolute -left-10 top-[-72px] h-56 w-56 rounded-full bg-white/24 blur-3xl" />
              <div className="pointer-events-none absolute right-[-96px] top-[22%] h-72 w-72 rounded-full bg-[#ffd9c7]/40 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_68%,rgba(255,255,255,0.26),transparent_44%)]" />

              <div className="relative grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-end">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f1d11]"
                    data-tina-field={tinaField(home.hero, "kicker")}
                  >
                    {home.hero.kicker}
                  </p>
                  <h1
                    className="mt-3 max-w-3xl font-display text-4xl leading-[0.95] tracking-[-0.02em] text-[#fff8f4] sm:text-5xl md:text-6xl"
                    data-tina-field={tinaField(home.hero, "heading")}
                  >
                    {home.hero.heading}
                  </h1>
                  <p
                    className="mt-5 max-w-2xl text-sm leading-relaxed text-[#ffe6da] md:text-base"
                    data-tina-field={tinaField(home.hero, "subheading")}
                  >
                    {home.hero.subheading}
                  </p>

                  <div className="mt-7 flex flex-wrap gap-2.5">
                    <ActionLink action={home.hero.primaryAction} field={tinaField(home.hero, "primaryAction")} tone="dark" />
                    <ActionLink action={home.hero.secondaryAction} field={tinaField(home.hero, "secondaryAction")} tone="light" />
                    <ActionLink action={home.hero.tertiaryAction} field={tinaField(home.hero, "tertiaryAction")} tone="ghost" />
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {capabilitySignals.map((signal) => (
                      <div
                        className="rounded-full border border-white/40 bg-white/12 px-3 py-1.5 text-[11px] text-[#fff7f1]"
                        key={signal.label.value}
                      >
                        <span className="font-medium" data-tina-field={signal.label.field}>{signal.label.value}:</span>{" "}
                        <span className="font-semibold" data-tina-field={signal.value.field}>{signal.value.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -inset-4 rounded-[24px] bg-white/14 blur-2xl" />
                  <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/28 p-3 shadow-[0_24px_38px_rgba(88,20,7,0.22)] backdrop-blur-sm">
                    <Image
                      alt={workflowStory?.title ?? "deAPI product preview"}
                      className="h-[260px] w-full rounded-xl object-cover md:h-[292px]"
                      data-tina-field={tinaField(home.hero, "backgroundImage")}
                      height={780}
                      src={heroMediaImage}
                      width={980}
                    />
                    <div className="mt-3 rounded-xl border border-white/45 bg-white/86 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d2c14]">Gateway Status</p>
                      <p className="mt-1 text-xs text-[#6b3e29]">OpenAPI-compatible surface, margin checks enabled, provider fallback active.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {trustedLogos.length > 0 ? (
        <section className="border-y border-[#dddddd] bg-[#efefef] py-7" data-tina-field={tinaField(home, "trustedBySection")}>
          <div className="mx-auto max-w-7xl px-4">
            <Reveal as="div" className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d6d6d]">
                Backed by teams building production AI
              </p>
            </Reveal>

            <Reveal as="div" className="relative mt-5 overflow-hidden" y={14}>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#efefef] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#efefef] to-transparent" />

              <div className="marquee-track flex w-max gap-2 [--marquee-duration:26s]">
                {trustedMarqueeLogos.map((logo, index) => (
                  <TrustedLogoPill key={`${logo.id}-${index}`} logo={logo} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="bg-[#ececec] py-8 md:py-12" data-tina-field={tinaField(home, "spotlightSection")}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-xl border border-[#dedede] bg-[#f2f2f2] p-5 md:p-8">
            <Reveal as="div" className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7b7b7b]" data-tina-field={tinaField(home.spotlightSection, "kicker")}>
                {home.spotlightSection.kicker}
              </p>
              <h2 className="mt-2 text-3xl leading-tight text-[#1a1a1a] md:text-4xl" data-tina-field={tinaField(home.spotlightSection, "title")}>
                {home.spotlightSection.title}
              </h2>
            </Reveal>

            <div className="mt-6 grid gap-4 border-y border-[#dedede] py-4 sm:grid-cols-3">
              {frameworkCells.map((cell, index) => (
                <Reveal as="div" delay={index * 0.06} key={cell.label} y={12}>
                  <FrameworkCell body={cell.body} label={cell.label} />
                </Reveal>
              ))}
            </div>

            <div className="mt-7 grid gap-5">
              <FeatureStory
                actionLabel={spotlightAction1.value}
                actionLabelField={spotlightAction1.field}
                card={spotlightCards[0]}
                image={stories[0]?.image ?? home.hero.backgroundImage}
                imageField={stories[0] ? tinaField(stories[0], "image") : tinaField(home.hero, "backgroundImage")}
                linkHref={home.hero.primaryAction.href}
                reverse={false}
              />
              <FeatureStory
                actionLabel={spotlightAction2.value}
                actionLabelField={spotlightAction2.field}
                card={spotlightCards[1] ?? spotlightCards[0]}
                image={resourcePreview?.image ?? home.hero.backgroundImage}
                imageField={resourcePreview ? tinaField(resourcePreview, "image") : tinaField(home.hero, "backgroundImage")}
                linkHref={home.hero.secondaryAction.href}
                reverse
              />
              <FeatureStory
                actionLabel={spotlightAction3.value}
                actionLabelField={spotlightAction3.field}
                card={spotlightCards[2] ?? spotlightCards[0]}
                image={stories[1]?.image ?? home.hero.backgroundImage}
                imageField={stories[1] ? tinaField(stories[1], "image") : tinaField(home.hero, "backgroundImage")}
                linkHref={home.contactPanel.primaryAction.href}
                reverse={false}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#ececec] py-3 pb-10 md:pb-12" data-tina-field={tinaField(home, "capabilitySection")}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-xl border border-[#dedede] bg-[#f5f5f5] p-5 md:p-8">
            <Reveal as="div" className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl leading-tight text-[#1b1b1b] md:text-3xl" data-tina-field={tinaField(home.capabilitySection, "title")}>
                {home.capabilitySection.title}
              </h2>
            </Reveal>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {valueCards.map((card, index) => (
                <Reveal as="article" className="rounded-lg border border-[#dddddd] bg-white p-4" delay={index * 0.08} key={card.id}>
                  <div className="h-36 rounded-md border border-[#ececec] bg-[radial-gradient(circle_at_20%_20%,#f8e8dd_0%,#efeef3_52%,#e9eff1_100%)]" />
                  <h3 className="mt-3 text-sm font-semibold text-[#1f1f1f]" data-tina-field={tinaField(card, "title")}>
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5f5f5f]" data-tina-field={tinaField(card, "description")}>
                    {card.description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfdfdf] bg-[#f2f2f2] py-12" data-tina-field={operationalHeading.field}>
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div" className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl leading-tight text-[#1a1a1a] md:text-4xl">{operationalHeading.value}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#676767]" data-tina-field={operationalBody.field}>{operationalBody.value}</p>
          </Reveal>

          <Reveal as="div" className="mx-auto mt-7 max-w-3xl rounded-lg border border-[#d7d7d7] bg-white p-4 shadow-[0_18px_28px_rgba(0,0,0,0.08)]">
            <Image
              alt={workflowStory?.title ?? "Workflow preview"}
              className="h-[260px] w-full rounded-md border border-[#ececec] object-cover"
              data-tina-field={workflowStory ? tinaField(workflowStory, "image") : tinaField(home.hero, "backgroundImage")}
              height={860}
              src={workflowStory?.image ?? home.hero.backgroundImage}
              width={1320}
            />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[#dddddd] bg-[#efefef] py-12">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <Reveal as="div">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b7b]">Coverage</p>
            <h2 className="mt-2 text-3xl leading-tight text-[#191919] md:text-4xl">Every Channel. Every Team. One Enforcement Layer.</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#646464]" data-tina-field={planningBody.field}>{planningBody.value}</p>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {omnichannelTiles.map((tile, index) => (
              <Reveal as="article" className="rounded-lg border border-[#dcdcdc] bg-[#f8f8f8] p-4" delay={index * 0.08} key={tile.title}>
                <div className="flex items-center gap-2">
                  <tile.icon className="size-4 text-[#2b2b2b]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2a2a2a]">{tile.title}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#616161]">{tile.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ececec] py-12" data-tina-field={planningHeading.field}>
        <div className="mx-auto grid max-w-7xl gap-7 px-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <Reveal as="div">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b7b]">Developers</p>
            <h2 className="mt-2 text-3xl leading-tight text-[#181818] md:text-4xl">{planningHeading.value}</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#5e5e5e]">
              Deploy with familiar API contracts, then layer in gateway controls for auth, billing, and fallback routing without rewriting clients.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {home.contactPanel.visible ? (
                <ActionLink action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} tone="ink" />
              ) : null}
              <ActionLink action={home.hero.secondaryAction} field={tinaField(home.hero, "secondaryAction")} tone="outline" />
            </div>
          </Reveal>

          <div className="grid gap-3">
            <Reveal as="div" className="rounded-lg border border-[#2d2d2d] bg-[#131313] p-4 text-[#f0f0f0]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b6b6b6]">Request</p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed"><code>{requestSample}</code></pre>
            </Reveal>
            <Reveal as="div" className="rounded-lg border border-[#2d2d2d] bg-[#0f0f0f] p-4 text-[#f6f6f6]" delay={0.08}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b6b6b6]">Response</p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed"><code>{responseSample}</code></pre>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dddddd] bg-[#f0f0f0] py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Reveal as="div">
            <h2 className="text-3xl leading-tight text-[#1f1f1f] md:text-4xl">Engineered For Regulated Institutions</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#666666]">
              Built for teams that require auditability, predictable billing records, and explicit routing guardrails before requests reach model providers.
            </p>
          </Reveal>
        </div>
      </section>

      {home.contactPanel.visible ? (
        <section className="bg-[#ececec] py-10 md:py-14" data-tina-field={tinaField(home, "contactPanel")}>
          <div className="mx-auto max-w-7xl px-4">
            <Reveal
              as="div"
              className="overflow-hidden rounded-[20px] border border-[#9caee8] bg-[linear-gradient(120deg,#2f58d8_0%,#5b7ee1_36%,#8a88e5_68%,#c78ce8_100%)] p-6 text-white md:p-10"
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e2e9ff]" data-tina-field={tinaField(home.contactPanel, "kicker")}>
                    {home.contactPanel.kicker}
                  </p>
                  <h2 className="mt-2 text-3xl leading-tight md:text-4xl" data-tina-field={tinaField(home.contactPanel, "heading")}>
                    {commandHeading.value}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#f2f4ff]" data-tina-field={tinaField(home.contactPanel, "body")}>
                    {commandBody.value}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <ActionLink action={home.contactPanel.primaryAction} field={tinaField(home.contactPanel, "primaryAction")} tone="dark" />
                    <ActionLink action={home.contactPanel.secondaryAction} field={tinaField(home.contactPanel, "secondaryAction")} tone="light" />
                  </div>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[#d9e2ff]" data-tina-field={supportPrompt.field}>{supportPrompt.value}</p>
                </div>

                <div className="rounded-xl border border-white/35 bg-white/16 p-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#e8edff]">Customer Note</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#f8f9ff]">
                    {testimonial ? (
                      <>
                        &ldquo;{testimonial.quote}&rdquo;
                        <span className="mt-2 block text-[11px] uppercase tracking-[0.14em] text-[#dce2ff]">
                          {testimonial.company} / {testimonial.role}
                        </span>
                      </>
                    ) : (
                      "\u201cUnified contracts and built-in guardrails gave our team confidence to launch quickly without losing control.\u201d"
                    )}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}
    </>
  )
}

function FrameworkCell({ body, label }: { body: string; label: string }) {
  return (
    <div className="rounded-md border border-[#e3e3e3] bg-white px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#292929]">{label}</p>
      <p className="mt-1 text-xs text-[#6b6b6b]">{body}</p>
    </div>
  )
}

function FeatureStory({
  actionLabel,
  actionLabelField,
  card,
  image,
  imageField,
  linkHref,
  reverse,
}: {
  actionLabel: string
  actionLabelField?: string
  card?: HomeContent["spotlightCards"][number]
  image: string
  imageField: string
  linkHref: string
  reverse: boolean
}) {
  if (!card) {
    return null
  }

  return (
    <Reveal as="article" className={`grid gap-5 rounded-lg border border-[#dddddd] bg-white p-4 md:p-5 ${reverse ? "lg:grid-cols-[1fr_0.95fr]" : "lg:grid-cols-[0.95fr_1fr]"}`}>
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="inline-flex items-center gap-2 rounded-full border border-[#dfdfdf] bg-[#f7f7f7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6a]">
          <SiteIcon className="size-3.5 text-[#343434]" icon={card.icon} />
          Section
        </p>
        <h3 className="mt-3 text-2xl leading-tight text-[#1f1f1f]" data-tina-field={tinaField(card, "title")}>{card.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#636363]" data-tina-field={tinaField(card, "description")}>{card.description}</p>
        <QuoteAwareLink
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#151515] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-black"
          href={linkHref}
          quoteLabel={actionLabel}
        >
          <span data-tina-field={actionLabelField}>{actionLabel}</span>
          <ArrowRight className="size-3.5" />
        </QuoteAwareLink>
      </div>

      <div className={reverse ? "lg:order-1" : ""}>
        <div className="h-full rounded-lg border border-[#ececec] bg-[radial-gradient(circle_at_18%_18%,#fbe5d8_0%,#f2eff4_45%,#ebeef2_100%)] p-3">
          <Image
            alt={card.title}
            className="h-[240px] w-full rounded-md border border-[#ebebeb] object-cover"
            data-tina-field={imageField}
            height={680}
            src={image}
            width={1020}
          />
        </div>
      </div>
    </Reveal>
  )
}

function TrustedLogoPill({
  logo,
}: {
  logo: HomeContent["trustedBySection"]["logos"][number]
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-center gap-2 rounded-md border border-[#d9d9d9] bg-[#f7f7f7] px-3 py-2.5"
      data-tina-field={tinaField(logo)}
    >
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-semibold uppercase text-white"
        data-tina-field={tinaField(logo, "abbreviation")}
      >
        {logo.abbreviation}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#323232]" data-tina-field={tinaField(logo, "name")}>
        {logo.name}
      </span>
    </div>
  )
}

function ActionLink({
  action,
  field,
  tone,
}: {
  action: HomeAction
  field: string
  tone: "dark" | "light" | "ghost" | "ink" | "outline"
}) {
  const className =
    tone === "dark"
      ? "inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-black"
      : tone === "light"
        ? "inline-flex items-center gap-2 rounded-md border border-white/55 bg-white/88 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1c1c1c] transition hover:bg-white"
        : tone === "ghost"
          ? "inline-flex items-center gap-2 rounded-md border border-white/42 bg-transparent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/14"
          : tone === "ink"
            ? "inline-flex items-center gap-2 rounded-md bg-[#171717] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-black"
            : "inline-flex items-center gap-2 rounded-md border border-[#272727] bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#222222] transition hover:bg-[#f4f4f4]"

  return (
    <QuoteAwareLink className={className} data-tina-field={field} href={action.href} quoteLabel={action.label}>
      {action.label}
      {tone === "dark" || tone === "ink" ? <ArrowRight className="size-3.5" /> : null}
    </QuoteAwareLink>
  )
}
