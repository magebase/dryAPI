import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Music,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  TrendingUp,
  Video,
} from "lucide-react";
import Image from "next/image";
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
  const valueCards = home.capabilityCards
    .filter((card) => card.visible)
    .slice(0, 3);
  const trustedLogos = home.trustedBySection.logos.slice(0, 8);

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
        "Standard TypeScript/Fetch API",
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
    "Deploy With Type-Safe API Access",
  );
  const omnichannelBody = resolveSiteUiText(
    site,
    "home.omnichannel.body",
    "Run chat, image, speech, video, and embedding models through a single endpoint. Switch models without reworking your integration.",
  );

  const commandHeading = resolveSiteUiText(
    site,
    "home.commandCta.heading",
    "Launch Multi-Model AI Fast With Cheap, Scalable API Access",
  );
  const commandBody = resolveSiteUiText(
    site,
    "home.commandCta.bodySuffix",
    "Talk to our team about model selection, type-safe API rollout, and a price-performance plan that fits your workload.",
  );

  const supportPrompt = resolveSiteUiText(
    site,
    "footer.supportPrompt",
    "Need Help Picking Models, Pricing, Or API Rollout?",
  );

  const requestSample = `const res = await fetch("https://api.dryapi.dev/v1/inference", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.DRYAPI_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "flux-schnell",
    prompt: "A neon-lit cyberpunk city terminal",
    params: { quality: "hd", aspect_ratio: "16:9" }
  })
});

const result = await res.json();`;
  const responseSample = `{
  "id": "gen_82dk1",
  "status": "succeeded",
  "output": ["https://assets.dryapi.dev/img/32dk..."],
  "meta": { "latency": "1.2s", "cost": 0.003 }
}`;

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

  const omnichannelTilePreviewImages = [
    "agent-chatbot-text-generation",
    "image-generation",
    "speech-generation",
    "ocr",
    "video-generation",
    "music-generation",
  ];

  const frameworkCells = [
    { label: "Choose", body: "Pick the best model by task" },
    { label: "Plug In", body: "Connect via simple TypeScript fetch" },
    { label: "Scale", body: "Route for price, speed, and throughput" },
  ];

  const heroMetrics = [
    { value: "10+", label: "Production Models" },
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
          {home.hero.backgroundImage && (
            <Image
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
              data-tina-field={tinaField(home.hero, "backgroundImage")}
              fill
              priority
              src={home.hero.backgroundImage}
            />
          )}
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 mb-6 backdrop-blur-sm">
                    <div className="size-2 animate-pulse rounded-full bg-indigo-400" />
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70"
                      data-tina-field={tinaField(home.hero, "kicker")}
                    >
                      {home.hero.kicker}
                    </p>
                  </div>
                  <h1
                    className="mt-4 max-w-3xl whitespace-pre-line bg-gradient-to-b from-white via-[#dceeff] to-[#91cfff] bg-clip-text font-display text-5xl leading-[0.92] tracking-[-0.03em] text-transparent sm:text-6xl md:text-7xl"
                    data-tina-field={tinaField(home.hero, "heading")}
                  >
                    {home.hero.heading}
                  </h1>
                  <p
                    className="text-site-inverse-muted mt-6 max-w-xl text-base leading-relaxed md:text-lg"
                    data-tina-field={tinaField(home.hero, "subheading")}
                  >
                    {home.hero.subheading}
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <QuoteAwareLink
                      className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[color:var(--cta-cool-a)] to-[color:var(--cta-cool-b)] px-7 py-4 text-sm font-bold tracking-tight text-white shadow-[0_16px_40px_-8px_rgba(40,80,200,0.45)] transition hover:brightness-110 hover:shadow-[0_20px_48px_-8px_rgba(40,80,200,0.55)] active:scale-[0.98]"
                      data-tina-field={tinaField(home.hero, "primaryAction")}
                      href={home.hero.primaryAction.href}
                      quoteLabel={home.hero.primaryAction.label}
                    >
                      {home.hero.primaryAction.label}
                      <ArrowRight className="size-4" />
                    </QuoteAwareLink>
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
                    {/* {trustedMarqueeLogos.map((logo, index) => (
                      <TrustedLogoPill
                        key={`${logo.id}-${index}`}
                        logo={logo}
                      />
                    ))} */}
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
                {/* {trustedMarqueeLogos.map((logo, index) => (
                  <TrustedLogoPill key={`${logo.id}-${index}`} logo={logo} />
                ))} */}
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
              Pick the right model for every job, integrate in minutes, and pay
              only for what you use.
            </p>
          </Reveal>

          <div className="mt-12 md:mt-20">
            <div className="grid gap-6 border-y border-[#dedede] py-8 sm:grid-cols-3">
              {frameworkCells.map((cell) => (
                <div key={cell.label}>
                  <FrameworkCell body={cell.body} label={cell.label} />
                </div>
              ))}
            </div>

            <div className="mt-12 grid gap-8">
              <FeatureStory
                actionLabel={spotlightAction1.value}
                actionLabelField={spotlightAction1.field}
                card={spotlightCards[1]}
                linkHref={home.hero.secondaryAction.href}
                reverse={false}
                type="image"
              />
              <FeatureStory
                actionLabel={spotlightAction2.value}
                actionLabelField={spotlightAction2.field}
                card={spotlightCards[2] ?? spotlightCards[1]}
                linkHref={home.contactPanel.primaryAction.href}
                reverse
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
                  Ship integrations with type-safe fetch requests and
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
        className="bg-[#ececec] py-10 md:py-14"
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
                <article
                  className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                  key={card.id}
                >
                  <div className="relative h-40 rounded-lg border border-[#f0f0f0] overflow-hidden bg-[linear-gradient(135deg,#f8faff_0%,#ffffff_50%,#fdfaff_100%)]">
                    {card.image && (
                      <Image
                        alt={card.title}
                        fill
                        className="object-cover opacity-20 transition-opacity group-hover:opacity-100"
                        src={card.image}
                      />
                    )}
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
                </article>
              ))}
            </div>
          </div>
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
                code={`const res = await fetch("https://api.dryapi.dev/v1/inference", {
  method: "POST",
  headers: { "Authorization": "Bearer " + KEY },
  body: JSON.stringify({
    model: "flux-schnell",
    prompt: "Cyberpunk terminal",
    params: { quality: "hd" }
  })
})

const { output } = await res.json()`}
              />
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
              Use standard TypeScript and Fetch API primitives to reach 150+
              models with predictable request shapes and full type safety.
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
                  Full Model Coverage
                </p>
              </div>
              <h3 className="font-display text-4xl tracking-tight text-slate-900 md:text-5xl">
                One API, Every Modality
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
                <article
                  key={tile.title}
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

                  <div className="relative mt-8 aspect-[1.6/1] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 grayscale-[0.1] transition-all duration-700 group-hover:scale-[1.05] group-hover:bg-white group-hover:grayscale-0">
                    <Image
                      alt={tile.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110 saturate-150"
                      src={`/landing/${omnichannelTilePreviewImages[idx % omnichannelTilePreviewImages.length]}.png`}
                    />
                  </div>

                  <div className="relative mt-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-900">
                    <div className="h-px w-8 bg-slate-200 transition-all group-hover:w-12 group-hover:bg-slate-900" />
                    Explore {tile.title}
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Use cases grid */}
      <section
        className="bg-white py-16 md:py-24"
        data-landing-slot="use-cases"
        id="landing-slot-use-cases"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div">
            <div className="mb-20 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                Vertical Solutions
              </p>
              <h3 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
                Built for Scalable AI Operations
              </h3>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-500">
                From customer support automation to content generation at scale
                — one API contract handles routing, billing, and scaling.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <UseCaseCard
                body="Automated triage and safe responses across every customer touchpoint."
                icon={MessageSquare}
                title="Customer Support"
                type="chat"
                image="/landing/agent-chat-generation.png"
              />
              <UseCaseCard
                body="OCR, embeddings, and retrieval to extract value from massive datasets."
                icon={FileText}
                title="Document Intelligence"
                type="embeddings"
                image="/landing/text-ocr-embeddings.png"
              />
              <UseCaseCard
                body="High-volume, low-cost image pipelines with professional quality tiers."
                icon={ImageIcon}
                title="Image Generation"
                type="image"
                image="/landing/image-generation.png"
              />
            </div>
          </Reveal>
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
              Built with security at every layer
            </h3>
            <p className="text-site-muted mt-3 text-sm">
              API key auth, rate limits, Stripe billing controls, and HTTPS on
              every request.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5">
                <ShieldCheck className="size-4 text-[#2b6cb0]" />
                <span className="text-xs font-semibold text-slate-700">
                  Auth on every key
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5">
                <ShieldCheck className="size-4 text-[#2b6cb0]" />
                <span className="text-xs font-semibold text-slate-700">
                  Per-key rate limits
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5">
                <ShieldCheck className="size-4 text-[#2b6cb0]" />
                <span className="text-xs font-semibold text-slate-700">
                  Stripe billing controls
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5">
                <ShieldCheck className="size-4 text-[#2b6cb0]" />
                <span className="text-xs font-semibold text-slate-700">
                  HTTPS end-to-end
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing band */}
      <section
        className="bg-white py-10 md:py-16"
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
                    {/* <div className="size-2 rounded-full bg-indigo-500" /> */}
                    {/* <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      Customer Success
                    </p> */}
                  </div>

                  {/* {testimonial ? (
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
                      &ldquo;We replaced multiple provider integrations with
                      dryAPI and cut onboarding time for new AI features
                      dramatically.&rdquo;
                    </p>
                  )} */}

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
    <article
      className={`group grid gap-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[color:var(--cta-cool-a)] hover:shadow-2xl md:p-8 ${reverse ? "lg:grid-cols-[1.05fr_0.95fr]" : "lg:grid-cols-[0.95fr_1.05fr]"}`}
    >
      <div
        className={`flex flex-col justify-center ${reverse ? "lg:order-2" : ""}`}
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-110">
          <SiteIcon className="size-5 text-white" icon={card.icon} />
        </div>
        <h3
          className="text-site-strong mt-5 text-3xl font-display leading-[1.1] tracking-tight md:text-4xl"
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
          <div className="relative z-10 h-full w-full overflow-hidden rounded-xl border border-white/80 bg-white/40 shadow-2xl backdrop-blur-sm">
            <Image
              alt={card.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              src={card.image ?? "/landing/generic-models-dashboard.png"}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function UseCaseCard({
  title,
  body,
  icon: Icon,
  type,
  image,
}: {
  title: string;
  body: string;
  icon: React.ElementType;
  type: MockUiPreviewProps["type"];
  image?: string;
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

      <div className="mt-6 aspect-[1.4/1] w-full overflow-hidden rounded-xl border border-black/5 bg-slate-50/50  transition-all duration-500 group-hover:bg-white group-hover:grayscale-0">
        <div className="relative h-full w-full">
          <Image
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            src={image ?? "/landing/chatbot-dashboard.png"}
          />
          <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-900">
        Deploy pipeline
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
      </div>
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
                    style={{ height: `${24 + ((i * 17) % 61)}%` }}
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
                    style={{ opacity: 0.5 + ((i * 13) % 5) * 0.1 }}
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
      <Image
        alt="AI touching mesh"
        fill
        className="object-cover rounded-md"
        src="/landing/hero.png"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(8,10,20,0.18))]" />
      <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/15 bg-black/20 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70"></p>
            <p className="text-xs text-white/75"></p>
          </div>
          <div className="h-1.5 w-20 rounded-full bg-emerald-400/50" />
        </div>
      </div>
    </div>
  );
}

function MockCodePanel({ code }: { code?: string }) {
  const defaultCode = `const res = await fetch("https://api.dryapi.dev/v1/inference", {
  method: "POST",
  headers: { "Authorization": "Bearer " + KEY },
  body: JSON.stringify({
    model: "flux-schnell",
    prompt: "A neon-lit cyberpunk city",
    params: { quality: "hd", aspect_ratio: "16:9" }
  })
})`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-white/10" />
          <div className="size-2.5 rounded-full bg-white/10" />
          <div className="size-2.5 rounded-full bg-white/10" />
        </div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-white/40">
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
