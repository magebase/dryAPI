import Image from "next/image";
import {
  ArrowRight,
  Code2,
  FileText,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Mic,
  Music,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  TrendingUp,
  Video,
} from "lucide-react";
import { tinaField } from "tinacms/dist/react";

import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { Reveal } from "@/components/site/reveal";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import { SiteIcon } from "@/components/site/site-icon";
import type { HomeContent, SiteConfig } from "@/lib/site-content-schema";
import { HeroGradientCanvas } from "./hero-gradient-canvas";
import { PricingPlanCards } from "./pricing/plan-cards";

type HomeAction = HomeContent["hero"]["primaryAction"];

export function HomeSections({
  home,
  site,
}: {
  home: HomeContent;
  site: SiteConfig;
}) {
  const spotlightCards = home.spotlightCards
    .filter((card) => card.visible)
    .slice(0, 3);
  const capabilityCards = home.capabilityCards.filter((card) => card.visible);
  const valueCards = capabilityCards.slice(0, 3);
  const stories = home.projectShowcase.items
    .filter((item) => item.visible)
    .slice(0, 3);
  const workflowStory = stories[0];
  const resourcePreview = home.resourceShowcase.items.find(
    (item) => item.visible,
  );
  const trustedLogos = home.trustedBySection.logos.slice(0, 8);
  const trustedMarqueeLogos = [
    ...trustedLogos,
    ...trustedLogos,
    ...trustedLogos,
  ];
  const testimonial = home.testimonialsSection.items[0];

  const capabilitySignals = [
    {
      label: resolveSiteUiText(
        site,
        "home.capabilitySignal.label.1",
        "Catalog",
      ),
      value: resolveSiteUiText(
        site,
        "home.capabilitySignal.value.1",
        "Chat / Image / Speech / Video / OCR / Embeddings",
      ),
    },
    {
      label: resolveSiteUiText(
        site,
        "home.capabilitySignal.label.2",
        "Client Support",
      ),
      value: resolveSiteUiText(
        site,
        "home.capabilitySignal.value.2",
        "OpenAI and OpenRouter compatible",
      ),
    },
    {
      label: resolveSiteUiText(
        site,
        "home.capabilitySignal.label.3",
        "Economics",
      ),
      value: resolveSiteUiText(
        site,
        "home.capabilitySignal.value.3",
        "Cheap pricing, elastic scale",
      ),
    },
  ];

  const spotlightAction1 = resolveSiteUiText(
    site,
    "home.spotlightAction.1",
    "See Client Example",
  );
  const spotlightAction2 = resolveSiteUiText(
    site,
    "home.spotlightAction.2",
    "Browse Categories",
  );
  const spotlightAction3 = resolveSiteUiText(
    site,
    "home.spotlightAction.3",
    "Review Pricing",
  );

  const operationalHeading = resolveSiteUiText(
    site,
    "home.operationalProof.heading",
    "Model Variety Without Provider Sprawl",
  );
  const operationalBody = resolveSiteUiText(
    site,
    "home.operationalProof.body",
    "Pick the best model for each task, keep one integration surface, and scale traffic without multiplying provider-specific code.",
  );

  const planningHeading = resolveSiteUiText(
    site,
    "home.planning.heading",
    "Use The Clients You Already Know",
  );
  const omnichannelBody = resolveSiteUiText(
    site,
    "home.omnichannel.body",
    "One policy layer to manage Email, Chat, Docs, CRM, and media workflows.",
  );

  const commandHeading = resolveSiteUiText(
    site,
    "home.commandCta.heading",
    "Launch Multi-Model AI Fast With Cheap, Scalable API Access",
  );
  const commandBody = resolveSiteUiText(
    site,
    "home.commandCta.bodySuffix",
    "Talk to our team about model selection, OpenAI-compatible rollout, and a price-performance plan that fits your workload.",
  );

  const supportPrompt = resolveSiteUiText(
    site,
    "footer.supportPrompt",
    "Need Help Picking Models, Pricing, Or API Rollout?",
  );

  const requestSample = `import OpenAI from "openai"\n\nconst client = new OpenAI({\n  apiKey: process.env.DEAPI_API_KEY,\n  baseURL: "https://api.deapi.ai/v1"\n})\n\nconst result = await client.chat.completions.create({\n  model: "meta-llama/llama-3.3-70b-instruct",\n  messages: [{ role: "user", content: "Summarize this incident timeline" }]\n})`;
  const responseSample = `{\n  "id": "chatcmpl_82dk1",\n  "model": "meta-llama/llama-3.3-70b-instruct",\n  "choices": [{\n    "message": {\n      "role": "assistant",\n      "content": "Here is the short incident summary..."\n    }\n  }],\n  "usage": { "total_tokens": 812 }\n}`;

  const heroMediaImage = workflowStory?.image ?? home.hero.backgroundImage;

  const omnichannelTiles = [
    {
      title: "Chat",
      body: "Reach flagship chat, reasoning, and coding models without juggling provider-specific SDKs.",
      icon: MessageSquare,
    },
    {
      title: "Images",
      body: "Switch between fast, cheap image models and higher-fidelity generation on the same API surface.",
      icon: ImageIcon,
    },
    {
      title: "Speech",
      body: "Handle transcription, translation, and audio generation with stable request and response contracts.",
      icon: Mic,
    },
    {
      title: "Embeddings",
      body: "Use retrieval, rerank, OCR, and embedding models for search and document workflows at low cost.",
      icon: TerminalSquare,
    },
    {
      title: "Video",
      body: "Generate clips and product videos with the same auth, billing, and policy controls.",
      icon: Video,
    },
    {
      title: "Music",
      body: "Create background music and branded audio with stable request and response contracts.",
      icon: Music,
    },
  ];

  const frameworkCells = [
    { label: "Choose", body: "Pick the best model by task" },
    { label: "Plug In", body: "Keep your existing OpenAI-style client" },
    { label: "Scale", body: "Route for price, speed, and throughput" },
  ];

  const heroMetrics = [
    { value: "150+", label: "Production Models" },
    { value: "99.99%", label: "Gateway Uptime" },
    { value: "<220ms", label: "Median Route Overhead" },
  ];

  return (
    <>
      {home.hero.visible ? (
        <section
          className="relative -mt-[var(--site-header-height)] min-h-screen overflow-hidden bg-[var(--site-surface-0)] pt-[var(--site-header-height)]"
          data-landing-slot="hero"
          data-tina-field={tinaField(home, "hero")}
          id="landing-slot-hero"
        >
          <HeroGradientCanvas />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(168,118,255,0.32),transparent_42%),radial-gradient(circle_at_84%_18%,rgba(201,92,255,0.3),transparent_46%),radial-gradient(circle_at_66%_80%,rgba(255,108,181,0.2),transparent_52%),radial-gradient(circle_at_88%_88%,rgba(255,131,74,0.22),transparent_38%),linear-gradient(180deg,rgba(26,12,51,0.72)_0%,rgba(45,16,72,0.58)_46%,rgba(72,19,84,0.56)_78%,rgba(116,36,64,0.62)_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-36 mix-blend-screen bg-[radial-gradient(circle_at_24%_32%,rgba(185,132,255,0.22),transparent_52%),radial-gradient(circle_at_72%_64%,rgba(235,94,255,0.18),transparent_56%),radial-gradient(100%_62%_at_88%_92%,rgba(255,129,72,0.16),transparent_72%)] [animation:hero-aurora-drift_56s_ease-in-out_infinite_alternate] motion-reduce:animate-none" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-var(--site-header-height))] max-w-7xl flex-col px-4 pb-7 pt-6 md:pb-10 md:pt-8">
            <Reveal
              as="div"
              className="relative overflow-hidden rounded-[40px] border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-6 pb-12 pt-7 backdrop-blur-3xl md:px-16 md:pb-20 md:pt-16"
            >
              <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-[100px]" />
              <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(144,186,255,0.15),transparent_50%)]" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:40px_40px]" />

              <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 mb-6">
                    <div className="size-1.5 animate-pulse rounded-full bg-indigo-400" />
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"
                      data-tina-field={tinaField(home.hero, "kicker")}
                    >
                      {home.hero.kicker}
                    </p>
                  </div>
                  <h1
                    className="mt-3 max-w-3xl whitespace-pre-line bg-gradient-to-b from-white via-[#dceeff] to-[#91cfff] bg-clip-text font-display text-4xl leading-[0.95] tracking-[-0.02em] text-transparent sm:text-5xl md:text-6xl"
                    data-tina-field={tinaField(home.hero, "heading")}
                  >
                    {home.hero.heading}
                  </h1>
                  <p
                    className="text-site-inverse-muted mt-5 max-w-2xl text-sm leading-relaxed md:text-base"
                    data-tina-field={tinaField(home.hero, "subheading")}
                  >
                    {home.hero.subheading}
                  </p>

                  <div className="mt-7 flex flex-wrap gap-2.5">
                    <ActionLink
                      action={home.hero.primaryAction}
                      field={tinaField(home.hero, "primaryAction")}
                      tone="ink"
                    />
                    <ActionLink
                      action={home.hero.secondaryAction}
                      field={tinaField(home.hero, "secondaryAction")}
                      tone="outline"
                    />
                    <ActionLink
                      action={home.hero.tertiaryAction}
                      field={tinaField(home.hero, "tertiaryAction")}
                      tone="ghost"
                    />
                  </div>

                  <div className="mt-8 flex flex-wrap gap-2">
                    {capabilitySignals.map((signal) => (
                      <div
                        className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[11px] text-white/80 backdrop-blur-md transition-colors hover:bg-white/10"
                        key={signal.label.value}
                      >
                        <span
                          className="font-medium opacity-60"
                          data-tina-field={signal.label.field}
                        >
                          {signal.label.value}:
                        </span>{" "}
                        <span
                          className="font-semibold"
                          data-tina-field={signal.value.field}
                        >
                          {signal.value.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-1.5 sm:grid-cols-3">
                    {heroMetrics.map((metric) => (
                      <div
                        className="rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-black/30"
                        key={metric.label}
                      >
                        <p className="font-display text-2xl font-bold tracking-tight text-white">
                          {metric.value}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                  <div className="relative">
                    <div className="absolute -inset-4 rounded-[24px] bg-white/14 blur-2xl" />
                    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/28 p-2 shadow-[0_24px_38px_rgba(8,12,24,0.36)] backdrop-blur-sm">
                      <div className="h-[280px] w-full md:h-[340px]">
                        <MockWorkflowFrame className="h-full border-none shadow-none bg-white/40" />
                      </div>
                      <div className="mt-2 rounded-xl border border-white/45 bg-white/86 p-3">
                        <div className="flex items-center gap-2">
                          <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                            Gateway Active • 150+ Models
                          </p>
                        </div>
                        <p className="text-site-muted mt-1 text-xs">
                          Single-surface API dispatch for Chat, Image, Speech and Embeddings.
                          Optimized for profit margin and elastic scale.
                        </p>
                      </div>
                    </div>
                  </div>
              </div>
            </Reveal>

            {trustedLogos.length > 0 ? (
              <Reveal
                as="div"
                className="relative mt-7 bg-transparent opacity-100 md:mt-24"
                data-tina-field={tinaField(home, "trustedBySection")}
                y={14}
              >
                <p className="text-site-inverse-soft text-center text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Used by teams consolidating multi-model AI stacks
                </p>

                <div className="marquee-vignette relative left-1/2 mt-4 w-screen max-w-none -translate-x-1/2 overflow-hidden border-0 bg-transparent px-2 py-3 [--marquee-vignette-tint:transparent] md:px-4">
                  <div className="marquee-track bg-transparent flex w-max gap-2 [--marquee-duration:26s]">
                    {trustedMarqueeLogos.map((logo, index) => (
                      <TrustedLogoPill
                        key={`${logo.id}-${index}`}
                        logo={logo}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {trustedLogos.length > 0 && !home.hero.visible ? (
        <section
          className="border-y border-[#dddddd] bg-[#efefef] py-7"
          data-landing-slot="trusted-fallback"
          data-tina-field={tinaField(home, "trustedBySection")}
          id="landing-slot-trusted-fallback"
        >
          <div className="mx-auto max-w-7xl px-4">
            <Reveal as="div" className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d6d6d]">
                Used by teams consolidating multi-model AI stacks
              </p>
            </Reveal>

            <Reveal
              as="div"
              className="marquee-vignette relative left-1/2 mt-5 w-screen max-w-none -translate-x-1/2 overflow-hidden border-y border-[#dddddd] bg-transparent px-2 py-3 [--marquee-vignette-tint:transparent] md:px-4"
              y={14}
            >
              <div className="marquee-track flex w-max gap-2 [--marquee-duration:26s]">
                {trustedMarqueeLogos.map((logo, index) => (
                  <TrustedLogoPill key={`${logo.id}-${index}`} logo={logo} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section
        className="bg-[#f2f2f2] py-12 md:py-24"
        data-landing-slot="spotlight"
        data-tina-field={tinaField(home, "spotlightSection")}
        id="landing-slot-spotlight"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div" className="mx-auto max-w-4xl text-center">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--cta-cool-a)]"
              data-tina-field={tinaField(home.spotlightSection, "kicker")}
            >
              {home.spotlightSection.kicker}
            </p>
            <h2
              className="mt-3 text-4xl font-display leading-[1.1] text-[#111111] md:text-5xl"
              data-tina-field={tinaField(home.spotlightSection, "title")}
            >
              {home.spotlightSection.title}
            </h2>
            <p className="text-site-muted mt-5 text-lg">
              Strategic inference control for teams that prioritize stability, performance, and unit economics.
            </p>
          </Reveal>

          <div className="mt-12 md:mt-20">
            <div className="grid gap-6 border-y border-[#dedede] py-8 sm:grid-cols-3">
              {frameworkCells.map((cell, index) => (
                <Reveal as="div" delay={index * 0.06} key={cell.label} y={12}>
                  <FrameworkCell body={cell.body} label={cell.label} />
                </Reveal>
              ))}
            </div>

            <div className="mt-12 grid gap-8">
              <FeatureStory
                actionLabel={spotlightAction1.value}
                actionLabelField={spotlightAction1.field}
                card={spotlightCards[0]}
                linkHref={home.hero.primaryAction.href}
                reverse={false}
                type="policy"
              />
              <FeatureStory
                actionLabel={spotlightAction2.value}
                actionLabelField={spotlightAction2.field}
                card={spotlightCards[1] ?? spotlightCards[0]}
                linkHref={home.hero.secondaryAction.href}
                reverse
                type="audit"
              />
              <FeatureStory
                actionLabel={spotlightAction3.value}
                actionLabelField={spotlightAction3.field}
                card={spotlightCards[2] ?? spotlightCards[0]}
                linkHref={home.contactPanel.primaryAction.href}
                reverse={false}
                type="costs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Developer + infrastructure quickstart */}
      <section
        className="bg-gradient-to-b from-[var(--site-surface-1)] to-[var(--site-surface-2)] py-12 text-site-strong"
        data-landing-slot="developer-quickstart"
        id="landing-slot-developer-quickstart"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#0f2130] bg-gradient-to-b from-[var(--site-surface-1)] to-[var(--site-surface-2)] p-6 md:p-8"
          >
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Developers
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  API-first, production-ready
                </h3>
                <p className="text-site-muted mt-3 text-sm">
                  Ship integrations with familiar OpenAI-compatible clients and
                  predictable response shapes.
                </p>
                <div className="mt-5">
                  <ActionLink
                    action={home.hero.primaryAction}
                    field={tinaField(home.hero, "primaryAction")}
                    tone="light"
                  />
                </div>
              </div>

              <div>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-[#122034] bg-[var(--site-surface-0)] p-3">
                    <MockCodePanel />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-[var(--site-surface-0)] p-3">
                      <MockUiPreview compact type="chat" />
                    </div>
                    <div className="rounded-md bg-[var(--site-surface-0)] p-3">
                      <MockUiPreview compact type="embeddings" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        className="bg-[#ececec] py-3 pb-10 md:pb-12"
        data-landing-slot="capability-grid"
        data-tina-field={tinaField(home, "capabilitySection")}
        id="landing-slot-capability-grid"
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-xl border border-[#dedede] bg-[#f5f5f5] p-5 md:p-8">
            <Reveal as="div" className="mx-auto max-w-2xl text-center">
              <h2
                className="text-site-strong text-2xl leading-tight md:text-3xl"
                data-tina-field={tinaField(home.capabilitySection, "title")}
              >
                {home.capabilitySection.title}
              </h2>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {valueCards.map((card, index) => (
                <Reveal
                  as="article"
                  className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                  delay={index * 0.08}
                  key={card.id}
                >
                  <div className="h-40 rounded-lg border border-[#f0f0f0] overflow-hidden bg-[linear-gradient(135deg,#f8faff_0%,#ffffff_50%,#fdfaff_100%)]">
                    <MockUiPreview
                      compact
                      type={
                        index === 0
                          ? "chat"
                          : index === 1
                            ? "image"
                            : "embeddings"
                      }
                    />
                  </div>
                  <h3
                    className="text-site-strong mt-4 text-base font-bold tracking-tight"
                    data-tina-field={tinaField(card, "title")}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="text-site-muted mt-2 text-sm leading-relaxed"
                    data-tina-field={tinaField(card, "description")}
                  >
                    {card.description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three-card value grid (more distinct visuals) */}
      <section
        className="bg-white py-10"
        data-landing-slot="value-grid"
        id="landing-slot-value-grid"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#eef0f2] bg-white p-6 md:p-8"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                What Fast and Compliant Looks Like
              </p>
              <h2 className="text-site-strong mt-2 text-3xl leading-tight md:text-4xl">
                Outcomes, Not Hype
              </h2>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <ValueCard
                title="Policy Enforcement"
                body="Stop unsafe outputs before they leave your stack."
                accent="from-secondary/75 via-white to-accent/15"
                type="policy"
              />
              <ValueCard
                title="Audit Trails"
                body="Immutable, queryable logs for compliance reviews."
                accent="from-secondary/70 via-white to-primary/12"
                type="audit"
              />
              <ValueCard
                title="Predictable Costs"
                body="Reserve GPU seconds and cache embeddings to save money."
                accent="from-secondary/65 via-white to-accent/10"
                type="costs"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section
        className="border-y border-[#dfdfdf] bg-[#f2f2f2] py-12"
        data-landing-slot="operational-proof"
        data-tina-field={operationalHeading.field}
        id="landing-slot-operational-proof"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div" className="mx-auto max-w-2xl text-center">
            <h2 className="text-site-strong text-3xl leading-tight md:text-4xl">
              {operationalHeading.value}
            </h2>
            <p
              className="text-site-muted mt-3 text-sm leading-relaxed"
              data-tina-field={operationalBody.field}
            >
              {operationalBody.value}
            </p>
          </Reveal>

          <Reveal
            as="div"
            className="mx-auto mt-7 max-w-4xl rounded-xl border border-slate-200 bg-white p-2 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] md:p-4"
          >
            <div className="relative overflow-hidden rounded-lg bg-slate-950">
              <MockCodePanel
                code={`import OpenAI from "openai"

const client = new OpenAI({
  apiKey: "dry_sk_...",
  baseURL: "https://api.deapi.ai/v1"
})

// Unified inference across 150+ models
const res = await client.chat.completions.create({
  model: "anthropic/claude-3-5-sonnet",
  messages: [{ role: "user", content: "Optimize this workload" }]
})`}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Workflow proof with mock UI */}
      <section
        className="bg-[#fbfcfd] py-10"
        data-landing-slot="workflow-proof"
        id="landing-slot-workflow-proof"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#eef2f4] bg-white p-6 md:p-8"
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                  See It Work
                </p>
                <h3 className="text-site-strong mt-2 text-2xl font-semibold">
                  Policy checks in the flow
                </h3>
                <p className="text-site-muted mt-3 text-sm">
                  A compact mock shows how content is validated and approved
                  before delivery.
                </p>
              </div>

              <div>
                <MockWorkflowFrame />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        className="bg-[#ececec] py-12"
        data-landing-slot="api-planning"
        data-tina-field={planningHeading.field}
        id="landing-slot-api-planning"
      >
        <div className="mx-auto grid max-w-7xl gap-7 px-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <Reveal as="div">
            <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.16em]">
              API
            </p>
            <h2 className="text-site-strong mt-2 text-3xl leading-tight md:text-4xl">
              {planningHeading.value}
            </h2>
            <p className="text-site-muted mt-4 text-sm leading-relaxed">
              Use the official OpenAI SDK, OpenRouter-style request shapes, and
              one base URL to reach a wide range of models with minimal
              integration work.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {home.contactPanel.visible ? (
                <ActionLink
                  action={home.contactPanel.primaryAction}
                  field={tinaField(home.contactPanel, "primaryAction")}
                  tone="ink"
                />
              ) : null}
              <ActionLink
                action={home.hero.secondaryAction}
                field={tinaField(home.hero, "secondaryAction")}
                tone="outline"
              />
            </div>
          </Reveal>

          <div className="grid gap-3">
            <Reveal
              as="div"
              className="text-site-strong rounded-lg border border-[#2d2d2d] bg-[var(--site-surface-1)] p-4"
            >
              <p className="text-site-soft text-[10px] font-semibold uppercase tracking-[0.16em]">
                Request
              </p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{requestSample}</code>
              </pre>
            </Reveal>
            <Reveal
              as="div"
              className="text-site-strong rounded-lg border border-[#2d2d2d] bg-[var(--site-surface-0)] p-4"
              delay={0.08}
            >
              <p className="text-site-soft text-[10px] font-semibold uppercase tracking-[0.16em]">
                Response
              </p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{responseSample}</code>
              </pre>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Omnichannel coverage */}
      <section
        className="bg-white py-24"
        data-landing-slot="omnichannel"
        id="landing-slot-omnichannel"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div" className="relative">
            <div className="mb-16 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 mb-6">
                <div className="size-1.5 rounded-full bg-slate-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Omnichannel Layer
                </p>
              </div>
              <h3 className="font-display text-4xl tracking-tight text-slate-900 md:text-5xl">
                Unified Governance Across Every Channel
              </h3>
              <p
                className="mt-6 text-base leading-relaxed text-slate-500 md:text-lg"
                data-tina-field={omnichannelBody.field}
              >
                {omnichannelBody.value}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {omnichannelTiles.map((tile, idx) => (
                <Reveal
                  key={tile.title}
                  delay={idx * 0.05}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-slate-300 hover:shadow-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  
                  <div className="relative mb-6 flex items-center justify-between">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl ring-8 ring-slate-50 transition-transform duration-500 group-hover:scale-110">
                      <tile.icon className="size-6" />
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 shadow-sm transition-colors group-hover:bg-emerald-100">
                      Active
                    </div>
                  </div>

                  <div className="relative flex-1">
                    <h4 className="font-display text-xl font-semibold tracking-tight text-slate-900">
                      {tile.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {tile.body}
                    </p>
                  </div>

                  <div className="relative mt-8 aspect-[1.6/1] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 grayscale-[0.3] transition-all duration-700 group-hover:scale-[1.05] group-hover:bg-white group-hover:grayscale-0">
                    <MockUiPreview
                      compact
                      type={tile.title.toLowerCase() as any}
                    />
                  </div>

                  <div className="relative mt-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-900">
                    <div className="h-px w-8 bg-slate-200 transition-all group-hover:w-12 group-hover:bg-slate-900" />
                    Explorer {tile.title}
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section
        className="border-y border-[#dddddd] bg-[#f0f0f0] py-16"
        data-landing-slot="scale-banner"
        id="landing-slot-scale-banner"
      >
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Reveal as="div">
            <h2 className="text-site-strong text-3xl leading-tight md:text-4xl">
              Built To Scale Without Expensive Lock-In
            </h2>
            <p className="text-site-muted mx-auto mt-4 max-w-2xl text-sm leading-relaxed">
              Move from prototype volume to production spikes with elastic
              routing, predictable contracts, and pricing designed to stay
              competitive as usage grows.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Use cases grid */}
      <section
        className="bg-white py-24 md:py-32"
        data-landing-slot="use-cases"
        id="landing-slot-use-cases"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div">
            <div className="mb-20 text-center">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600"
              >
                Vertical Solutions
              </p>
              <h3 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
                Built for Scalable AI Operations
              </h3>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-500">
                From automated support to high-volume media synthesis, we handle
                the infrastructure so you can focus on the product.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <UseCaseCard
                body="Automated triage and safe responses across every customer touchpoint."
                icon={MessageSquare}
                title="Customer Support"
                type="chat"
              />
              <UseCaseCard
                body="OCR, embeddings, and retrieval to extract value from massive datasets."
                icon={FileText}
                title="Document Intelligence"
                type="embeddings"
              />
              <UseCaseCard
                body="High-volume, low-cost image pipelines with professional quality tiers."
                icon={ImageIcon}
                title="Image Generation"
                type="image"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Metrics / stats band */}
      <section
        className="relative overflow-hidden bg-white py-16 text-site-strong"
        data-landing-slot="metrics"
        id="landing-slot-metrics"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,118,255,0.06),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4">
          <Reveal as="div" className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-site-soft">
              Reliability Snapshot
            </p>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatBand label="Requests Served" value="1.2M+" />
            <StatBand label="Models Supported" value="150+" />
            <StatBand label="Gateway Uptime" value="99.99%" />
            <StatBand label="Active Tenants" value="300+" />
          </div>
        </div>
      </section>

      {/* Institutional trust / certifications */}
      <section
        className="bg-[#f7f9fb] py-10"
        data-landing-slot="trust-security"
        id="landing-slot-trust-security"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#eef2f4] bg-white p-6 md:p-8 text-center"
          >
            <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.12em]">
              Trust &amp; Security
            </p>
            <h3 className="text-site-strong mt-2 text-2xl font-semibold">
              Enterprise-grade monitoring and controls
            </h3>
            <p className="text-site-muted mt-3 text-sm">
              Certifications, audit logs, and strict access controls for
              regulated workloads.
            </p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#2b6cb0]" />
                <span className="text-sm font-semibold">SOC2</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#2b6cb0]" />
                <span className="text-sm font-semibold">ISO 27001</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing teaser */}
      {/* Pricing band */}
      <section
        className="bg-white"
        data-landing-slot="pricing"
        id="landing-slot-pricing"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div">
            <PricingPlanCards />
          </Reveal>
        </div>
      </section>

      {/* Final conversion band */}
      {!home.contactPanel.visible ? (
        <section
          className="overflow-hidden py-12"
          data-landing-slot="final-cta-band"
          id="landing-slot-final-cta-band"
        >
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-site-inverse rounded-[16px] bg-[linear-gradient(90deg,var(--cta-cool-a)_0%,var(--cta-cool-mid)_56%,var(--cta-cool-b)_100%)] p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.6fr] lg:items-center">
                <div>
                  <h3 className="text-3xl font-semibold">
                    Ready to consolidate your AI stack?
                  </h3>
                  <p className="text-site-inverse-muted mt-2 text-sm">
                    Talk with us about migration, pricing, and open
                    integrations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <ActionLink
                    action={home.contactPanel.primaryAction}
                    field={tinaField(home.contactPanel, "primaryAction")}
                    tone="dark"
                  />
                  <ActionLink
                    action={home.hero.secondaryAction}
                    field={tinaField(home.hero, "secondaryAction")}
                    tone="light"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {home.contactPanel.visible ? (
        <section
          className="bg-white py-24 md:py-32"
          data-landing-slot="contact-panel"
          data-tina-field={tinaField(home, "contactPanel")}
          id="landing-slot-contact-panel"
        >
          <div className="mx-auto max-w-7xl px-4">
            <Reveal
              as="div"
              className="relative overflow-hidden rounded-[48px] border border-white/20 bg-slate-900 px-8 py-16 text-white shadow-2xl md:px-20 md:py-24"
            >
              {/* Decorative backgrounds */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-[120px]" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(144,186,255,0.1),transparent_50%)]" />

              <div className="relative grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 mb-8">
                    <div className="size-1.5 animate-pulse rounded-full bg-indigo-400" />
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40"
                      data-tina-field={tinaField(home.contactPanel, "kicker")}
                    >
                      {home.contactPanel.kicker}
                    </p>
                  </div>
                  <h2
                    className="font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
                    data-tina-field={tinaField(home.contactPanel, "heading")}
                  >
                    {commandHeading.value}
                  </h2>
                  <p
                    className="mt-8 max-w-xl text-lg leading-relaxed text-slate-400"
                    data-tina-field={tinaField(home.contactPanel, "body")}
                  >
                    {commandBody.value}
                  </p>

                  <div className="mt-12 flex flex-wrap gap-4">
                    <ActionLink
                      action={home.contactPanel.primaryAction}
                      field={tinaField(home.contactPanel, "primaryAction")}
                      tone="ink"
                    />
                    <ActionLink
                      action={home.hero.secondaryAction}
                      field={tinaField(home.hero, "secondaryAction")}
                      tone="ghost"
                    />
                  </div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:p-12">
                  <div className="mb-8 flex items-center gap-2">
                    <div className="size-2 rounded-full bg-indigo-500" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      Customer Success
                    </p>
                  </div>
                  
                  {testimonial ? (
                    <div className="space-y-6">
                      <p className="font-display text-xl italic leading-relaxed text-white md:text-2xl">
                        &ldquo;{testimonial.quote}&rdquo;
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/40">
                          {testimonial.company.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase tracking-wider text-white">
                            {testimonial.company}
                          </p>
                          <p className="text-xs font-medium text-white/40">
                            {testimonial.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="font-display text-xl italic leading-relaxed text-white md:text-2xl">
                      &ldquo;We replaced multiple provider integrations with dryAPI and cut onboarding time for new AI features dramatically.&rdquo;
                    </p>
                  )}

                  <div className="mt-12 pt-10 border-t border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">
                      {supportPrompt.value}
                    </p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white transition-colors hover:text-indigo-400 cursor-pointer">
                      Start Migration Flow
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}
    </>
  );
}

function FrameworkCell({ body, label }: { body: string; label: string }) {
  return (
    <div className="rounded-md border border-[#e3e3e3] bg-white px-3 py-2.5">
      <p className="text-site-strong text-xs font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="text-site-muted mt-1 text-xs">{body}</p>
    </div>
  );
}

function FeatureStory({
  actionLabel,
  actionLabelField,
  card,
  linkHref,
  reverse,
  type = "default",
}: {
  actionLabel: string;
  actionLabelField?: string;
  card?: HomeContent["spotlightCards"][number];
  linkHref: string;
  reverse: boolean;
  type?:
    | "default"
    | "chat"
    | "image"
    | "speech"
    | "embeddings"
    | "video"
    | "music"
    | "policy"
    | "audit"
    | "costs";
}) {
  if (!card) {
    return null;
  }

  return (
    <Reveal
      as="article"
      className={`group grid gap-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[color:var(--cta-cool-a)] hover:shadow-2xl md:p-8 ${reverse ? "lg:grid-cols-[1.05fr_0.95fr]" : "lg:grid-cols-[0.95fr_1.05fr]"}`}
    >
      <div className={`flex flex-col justify-center ${reverse ? "lg:order-2" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-110">
            <SiteIcon className="size-5 text-white" icon={card.icon} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--cta-cool-a)]">
            Platform Protocol
          </p>
        </div>
        <h3
          className="text-site-strong mt-6 text-3xl font-display leading-[1.1] tracking-tight md:text-4xl"
          data-tina-field={tinaField(card, "title")}
        >
          {card.title}
        </h3>
        <p
          className="text-site-muted mt-5 text-base leading-relaxed md:text-lg"
          data-tina-field={tinaField(card, "description")}
        >
          {card.description}
        </p>
        <div className="mt-10">
          <QuoteAwareLink
            className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-8 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] transition-all hover:bg-slate-800 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-95"
            href={linkHref}
            quoteLabel={actionLabel}
          >
            <span data-tina-field={actionLabelField}>{actionLabel}</span>
            <ArrowRight className="size-4" />
          </QuoteAwareLink>
        </div>
      </div>

      <div className={`relative ${reverse ? "lg:order-1" : ""}`}>
        {/* Decorative background glow */}
        <div className="absolute -inset-20 bg-[radial-gradient(circle_at_center,rgba(84,126,232,0.08),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        
        <div className="relative aspect-[4/3] w-full transform overflow-hidden rounded-2xl bg-[#f8f9fb] p-1.5 shadow-inner transition-transform duration-700 group-hover:scale-[1.02] md:p-2.5">
          <div className="h-full w-full overflow-hidden rounded-xl border border-white/80 bg-white/40 shadow-2xl backdrop-blur-sm">
            <MockUiPreview
              className="bg-transparent"
              compact={false}
              type={type}
            />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function UseCaseCard({
  title,
  body,
  icon: Icon,
  type,
}: {
  title: string;
  body: string;
  icon: React.ElementType;
  type: MockUiPreviewProps["type"];
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg transition-transform group-hover:scale-110">
          <Icon className="size-5" />
        </div>
        <div className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          Ready to scale
        </div>
      </div>

      <h4 className="font-display text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>

      <div className="mt-6 aspect-[1.4/1] w-full overflow-hidden rounded-xl border border-black/5 bg-slate-50/50 grayscale-[0.2] transition-all duration-500 group-hover:bg-white group-hover:grayscale-0">
        <MockUiPreview compact className="scale-[0.8] origin-top" type={type} />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-900">
        Deploy pipeline
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

function StatBand({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative rounded-2xl border border-black/5 bg-slate-50/50 p-6 transition-colors hover:bg-white md:p-8 text-center">
      <div className="absolute inset-x-0 bottom-0 h-1 w-full scale-x-0 bg-slate-950 transition-transform duration-500 group-hover:scale-x-100" />
      <p className="text-3xl font-display font-bold tracking-tight text-slate-900 md:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function TrustedLogoPill({
  logo,
}: {
  logo: HomeContent["trustedBySection"]["logos"][number];
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-center gap-2 rounded-md border border-white/45 bg-white/65 px-3 py-2.5 shadow-[0_10px_24px_rgba(10,16,30,0.12)] backdrop-blur-md"
      data-tina-field={tinaField(logo)}
    >
      <span
        className="text-site-strong inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--site-surface-1)] text-[10px] font-semibold uppercase"
        data-tina-field={tinaField(logo, "abbreviation")}
      >
        {logo.abbreviation}
      </span>
      <span
        className="text-site-strong text-[10px] font-semibold uppercase tracking-[0.1em]"
        data-tina-field={tinaField(logo, "name")}
      >
        {logo.name}
      </span>
    </div>
  );
}

function ActionLink({
  action,
  field,
  tone,
}: {
  action: HomeAction;
  field: string;
  tone: "dark" | "light" | "ghost" | "ink" | "outline";
}) {
  const className =
    tone === "dark"
      ? "inline-flex items-center gap-2 rounded-md border border-white/28 bg-gradient-to-r from-[color:var(--cta-cool-a)] to-[color:var(--cta-cool-b)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-md transition hover:brightness-110"
      : tone === "light"
        ? "text-site-strong inline-flex items-center gap-2 rounded-md border border-white/55 bg-white/88 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:bg-white"
        : tone === "ghost"
          ? "text-site-inverse inline-flex items-center gap-2 rounded-md border border-white/42 bg-transparent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:bg-white/14"
          : tone === "ink"
            ? "inline-flex items-center gap-2 rounded-md border border-primary/35 bg-gradient-to-r from-[color:var(--cta-cool-a)] to-[color:var(--cta-cool-b)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-md transition hover:brightness-110"
            : "text-site-strong inline-flex items-center gap-2 rounded-md border border-[#272727] bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:bg-[#f4f4f4]";

  return (
    <QuoteAwareLink
      className={className}
      data-tina-field={field}
      href={action.href}
      quoteLabel={action.label}
    >
      {action.label}
      {tone === "dark" || tone === "ink" ? (
        <ArrowRight className="size-3.5" />
      ) : null}
    </QuoteAwareLink>
  );
}

interface MockUiPreviewProps {
  compact?: boolean;
  className?: string;
  type?:
    | "default"
    | "chat"
    | "image"
    | "speech"
    | "embeddings"
    | "video"
    | "music"
    | "policy"
    | "audit"
    | "costs";
}

function MockUiPreview({
  compact,
  className,
  type = "default",
}: MockUiPreviewProps) {
  return (
    <div
      className={
        "h-full w-full " +
        (compact ? "p-3" : "p-4 md:p-6") +
        (className ? " " + className : "")
      }
    >
      <div className="relative h-full overflow-hidden rounded-xl border border-white/45 bg-white/76 shadow-sm backdrop-blur-sm">
        {/* Browser Chrome */}
        <div className="flex items-center gap-1.5 border-b border-black/5 bg-black/4 px-3 py-1.5">
          <div className="flex gap-1">
            <div className="size-1.5 rounded-full bg-red-400/60" />
            <div className="size-1.5 rounded-full bg-yellow-400/60" />
            <div className="size-1.5 rounded-full bg-green-400/60" />
          </div>
          <div className="ml-2 h-2.5 w-24 rounded bg-black/5" />
        </div>

        <div className="p-3">
          {type === "chat" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="size-5 shrink-0 rounded bg-indigo-500/10 flex items-center justify-center">
                  <MessageSquare className="size-3 text-indigo-500/40" />
                </div>
                <div className="space-y-1 w-full">
                  <div className="h-2 w-full rounded bg-indigo-50/60" />
                  <div className="h-2 w-4/5 rounded bg-indigo-50/60" />
                </div>
              </div>
              <div className="flex flex-row-reverse gap-2">
                <div className="size-5 shrink-0 rounded bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="size-3 text-emerald-500/40" />
                </div>
                <div className="space-y-1 w-full flex flex-col items-end">
                  <div className="h-2 w-full rounded bg-emerald-50/60" />
                  <div className="h-4 w-full rounded bg-emerald-50/30 border border-emerald-500/5 mt-1" />
                </div>
              </div>
            </div>
          )}

          {type === "image" && (
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded border border-black/5 bg-gradient-to-br from-slate-50 to-slate-100"
                >
                  <div className="absolute inset-0 bg-white/40" />
                  {i === 1 && (
                    <div className="absolute inset-1 rounded-sm bg-orange-200/20" />
                  )}
                </div>
              ))}
            </div>
          )}

          {type === "speech" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                <Mic className="size-3.5 text-rose-500/60" />
                <div className="h-1.5 flex-1 rounded bg-black/5" />
              </div>
              <div className="flex h-8 items-end gap-0.5">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.random() * 80 + 20}%` }}
                    className="flex-1 rounded-t-sm bg-indigo-400/20"
                  />
                ))}
              </div>
              <div className="h-6 rounded border border-black/5 bg-white/40 p-1">
                <div className="h-full w-2/3 rounded bg-black/5" />
              </div>
            </div>
          )}

          {type === "embeddings" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-black/5 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <TerminalSquare className="size-3 text-indigo-500/40" />
                  <div className="h-1.5 w-12 rounded bg-black/10" />
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500/20" />
              </div>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 rounded-sm bg-black/5 transition-opacity duration-500"
                    style={{ opacity: Math.random() * 0.5 + 0.5 }}
                  />
                ))}
              </div>
            </div>
          )}

          {type === "policy" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-black/5 pb-1">
                <div className="h-1.5 w-20 rounded bg-red-400/10" />
                <ShieldAlert className="size-3 text-red-500/40" />
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="size-3 rounded bg-red-500/20" />
                  <div className="h-1.5 flex-1 rounded bg-black/5 pt-0.5">
                    <div className="h-full w-full rounded bg-red-500/10" />
                  </div>
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-2 opacity-50">
                    <div className="size-3 rounded bg-black/10" />
                    <div className="h-1.5 flex-1 rounded bg-black/5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === "audit" && (
            <div className="space-y-1 font-mono text-[8px] leading-none">
              <div className="flex justify-between border-b border-black/5 pb-1 text-slate-400">
                <span>TIMESTAMP</span>
                <span>EVENT</span>
              </div>
              {[
                { t: "12:04:11", e: "AUTH_SUCCESS", c: "bg-emerald-500/10" },
                { t: "12:04:12", e: "ROUTE_SELECT", c: "bg-blue-500/10" },
                { t: "12:04:15", e: "COMPLETION", c: "bg-indigo-500/10" },
                { t: "12:05:01", e: "BILL_RESERVE", c: "bg-amber-500/10" },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex justify-between border-b border-black/[0.02] py-0.5"
                >
                  <span className="text-slate-400">{row.t}</span>
                  <span className={`rounded px-1 ${row.c}`}>{row.e}</span>
                </div>
              ))}
            </div>
          )}

          {type === "costs" && (
            <div className="space-y-2">
              <div className="flex h-12 items-end justify-between gap-1 border-b border-black/5 pb-1">
                {[30, 60, 45, 90, 70, 85, 40, 55, 75, 95].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`flex-1 rounded-t-sm ${i === 9 ? "bg-amber-400" : "bg-black/10"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <div className="flex items-center gap-1">
                  <TrendingUp className="size-3 text-amber-500" />
                  <span className="text-slate-600">$124.50</span>
                </div>
                <div className="h-2 w-8 rounded bg-black/5" />
              </div>
            </div>
          )}

          {type === "default" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-inner" />
                <div className="space-y-1">
                  <div className="h-1.5 w-16 rounded bg-black/10" />
                  <div className="h-1 w-24 rounded bg-black/5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded bg-black/5" />
                <div className="h-1.5 w-full rounded bg-black/5" />
                <div className="h-1.5 w-3/4 rounded bg-black/5" />
                <div className="mt-2 h-6 w-full rounded border border-black/5 bg-black/[0.02]" />
              </div>
            </div>
          )}

          {/* Video/Music fallbacks */}
          {(type === "video" || type === "music") && (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-black/10 bg-black/5">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/50">
                {type === "video" ? (
                  <Video className="size-4 text-black/40" />
                ) : (
                  <Music className="size-4 text-black/40" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Accent */}
        <div className="absolute -right-8 -top-8 size-24 rounded-full bg-indigo-500/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 size-24 rounded-full bg-purple-500/5 blur-2xl" />
      </div>
    </div>
  );
}

function MockWorkflowFrame({ className }: { className?: string }) {
  return (
    <div
      className={
        "h-full w-full rounded-2xl border border-white/45 bg-white/76 shadow-sm backdrop-blur-sm p-4 md:p-6 flex flex-col " +
        (className ? " " + className : "")
      }
    >
      <div className="flex items-center gap-1.5 border-b border-black/5 pb-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 shrink-0">
          <TerminalSquare className="size-4 text-indigo-600/60" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-2 w-32 rounded bg-indigo-900/10" />
          <div className="h-1.5 w-24 rounded bg-indigo-900/5" />
        </div>
        <div className="ml-auto flex gap-1.5">
          <div className="size-6 rounded-md bg-black/5" />
          <div className="size-6 rounded-md bg-black/5" />
        </div>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-3 gap-3">
        {/* Card 1: Multi-Model Pipeline */}
        <div className="flex flex-col rounded-xl border border-indigo-500/10 bg-indigo-50/20 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600/70">
              Pipeline
            </span>
            <div className="size-2 animate-pulse rounded-full bg-indigo-500/40" />
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-2">
            {[
              { label: "LLAMA 3.3", color: "bg-blue-500/30", w: "w-full" },
              { label: "FLUX.1", color: "bg-orange-500/30", w: "w-4/5" },
              { label: "WHISPER", color: "bg-emerald-500/30", w: "w-11/12" },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-1.5 ${m.w} rounded-full ${m.color}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Strategic Margin */}
        <div className="flex flex-col rounded-xl border border-emerald-500/10 bg-emerald-50/20 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/70">
              Profit
            </span>
            <TrendingUp className="size-3 text-emerald-500/40" />
          </div>
          <div className="flex flex-1 flex-col justify-end">
            <div className="flex h-12 items-end gap-1">
              {[40, 70, 45, 90, 60, 80].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 rounded-sm bg-emerald-500/30"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Security & Policy */}
        <div className="flex flex-col rounded-xl border border-rose-500/10 bg-rose-50/20 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600/70">
              Compliance
            </span>
            <ShieldCheck className="size-3 text-rose-500/40" />
          </div>
          <div className="flex flex-1 flex-col space-y-2 pt-1">
            <div className="h-1.5 w-full rounded bg-rose-900/10" />
            <div className="h-1.5 w-3/4 rounded bg-rose-900/10" />
            <div className="mt-auto flex items-center gap-1">
              <div className="size-2 rounded-full bg-emerald-500/40" />
              <div className="h-1 w-8 rounded bg-rose-900/5" />
            </div>
          </div>
        </div>
      </div>

      {/* Code Dispatch Panel */}
      <div className="mt-4 shrink-0 rounded-xl border border-indigo-500/10 bg-indigo-900/[0.03] p-3 font-mono">
        <div className="mb-2 flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-indigo-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">
            Request Router Dispatch
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <span className="text-[10px] text-indigo-400 opacity-60">
              POST
            </span>
            <div className="h-2 w-48 rounded bg-indigo-900/10" />
          </div>
          <div className="flex gap-2 pl-4">
            <div className="h-1.5 w-32 rounded bg-indigo-900/10" />
            <div className="h-1.5 w-12 rounded bg-indigo-900/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueCard({
  title,
  body,
  accent,
  type,
}: {
  title: string;
  body: string;
  accent: string;
  type?:
    | "default"
    | "chat"
    | "image"
    | "speech"
    | "embeddings"
    | "policy"
    | "audit"
    | "costs";
}) {
  return (
    <div className="group rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div
        className={`rounded-lg p-2 bg-gradient-to-br ${accent} shadow-inner transition-transform group-hover:scale-[1.02]`}
      >
        <MockUiPreview compact type={type} />
      </div>
      <h3 className="text-site-strong mt-5 text-lg font-bold tracking-tight">
        {title}
      </h3>
      <p className="text-site-muted mt-2 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function MockCodePanel({ code }: { code?: string }) {
  const defaultCode = `// Fetch chat completion
const stream = await dryapi.chat.completions.create({
  model: "meta-llama/llama-3.3-70b-instruct",
  messages: [{ role: "user", content: "Analyze risk" }],
  stream: true,
});`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-white/10" />
          <div className="size-2.5 rounded-full bg-white/10" />
          <div className="size-2.5 rounded-full bg-white/10" />
        </div>
        <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
          typescript
        </div>
      </div>
      <div className="p-4 font-mono text-[11px] leading-relaxed">
        <pre className="text-indigo-300">
          <code>{code || defaultCode}</code>
        </pre>
      </div>
    </div>
  );
}

function LegacyStatBand({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/12 bg-white/4 px-4 py-3 text-center">
      <div className="text-site-strong text-2xl font-bold">{value}</div>
      <div className="text-site-muted mt-1 text-sm">{label}</div>
    </div>
  );
}
