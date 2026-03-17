import Image from "next/image";
import {
  ArrowRight,
  Image as ImageGlyph,
  MessageSquare,
  Mic,
  Music,
  ShieldCheck,
  TerminalSquare,
  Video,
} from "lucide-react";
import { tinaField } from "tinacms/dist/react";

import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { Reveal } from "@/components/site/reveal";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import { SiteIcon } from "@/components/site/site-icon";
import type { HomeContent, SiteConfig } from "@/lib/site-content-schema";
import { HeroGradientCanvas } from "./hero-gradient-canvas";

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
      icon: ImageGlyph,
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
              className="relative overflow-hidden rounded-[28px] border border-white/34 bg-[linear-gradient(140deg,rgba(255,255,255,0.16)_0%,rgba(186,144,255,0.28)_36%,rgba(196,92,255,0.44)_66%,rgba(246,122,86,0.52)_100%)] px-6 pb-8 pt-7 md:px-12 md:pb-12 md:pt-11"
            >
              <div className="pointer-events-none absolute -left-10 top-[-72px] h-56 w-56 rounded-full bg-[#cbe4ff]/18 blur-3xl" />
              <div className="pointer-events-none absolute right-[-96px] top-[22%] h-72 w-72 rounded-full bg-[#c263ff]/34 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_68%,rgba(255,255,255,0.22),transparent_44%)]" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light [background-image:radial-gradient(rgba(255,255,255,0.92)_0.6px,transparent_0.9px)] [background-size:3px_3px]" />

              <div className="relative grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-end">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary"
                    data-tina-field={tinaField(home.hero, "kicker")}
                  >
                    {home.hero.kicker}
                  </p>
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
                      tone="dark"
                    />
                    <ActionLink
                      action={home.hero.secondaryAction}
                      field={tinaField(home.hero, "secondaryAction")}
                      tone="light"
                    />
                    <ActionLink
                      action={home.hero.tertiaryAction}
                      field={tinaField(home.hero, "tertiaryAction")}
                      tone="ghost"
                    />
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {capabilitySignals.map((signal) => (
                      <div
                        className="text-site-inverse rounded-full border border-white/40 bg-white/12 px-3 py-1.5 text-[11px]"
                        key={signal.label.value}
                      >
                        <span
                          className="font-medium"
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

                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {heroMetrics.map((metric) => (
                      <div
                        className="rounded-lg border border-white/40 bg-white/15 px-3 py-2 backdrop-blur-sm"
                        key={metric.label}
                      >
                        <p className="text-site-inverse text-sm font-semibold">
                          {metric.value}
                        </p>
                        <p className="text-site-inverse-soft text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -inset-4 rounded-[24px] bg-white/14 blur-2xl" />
                  <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/28 p-3 shadow-[0_24px_38px_rgba(8,12,24,0.36)] backdrop-blur-sm">
                    <Image
                      alt={workflowStory?.title ?? "dryAPI product preview"}
                      className="h-[260px] w-full rounded-xl object-cover md:h-[292px]"
                      data-tina-field={tinaField(home.hero, "backgroundImage")}
                      height={780}
                      src={heroMediaImage}
                      width={980}
                    />
                    <div className="mt-3 rounded-xl border border-white/45 bg-white/86 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        Gateway Status
                      </p>
                      <p className="text-site-muted mt-1 text-xs">
                        OpenAI/OpenRouter compatible, broad model catalog
                        online, low-cost routing active.
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
        className="bg-[#ececec] py-8 md:py-12"
        data-landing-slot="spotlight"
        data-tina-field={tinaField(home, "spotlightSection")}
        id="landing-slot-spotlight"
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-xl border border-[#dedede] bg-[#f2f2f2] p-5 md:p-8">
            <Reveal as="div" className="max-w-4xl">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7b7b7b]"
                data-tina-field={tinaField(home.spotlightSection, "kicker")}
              >
                {home.spotlightSection.kicker}
              </p>
              <h2
                className="mt-2 text-3xl leading-tight text-[#1a1a1a] md:text-4xl"
                data-tina-field={tinaField(home.spotlightSection, "title")}
              >
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
                imageField={
                  stories[0]
                    ? tinaField(stories[0], "image")
                    : tinaField(home.hero, "backgroundImage")
                }
                linkHref={home.hero.primaryAction.href}
                reverse={false}
              />
              <FeatureStory
                actionLabel={spotlightAction2.value}
                actionLabelField={spotlightAction2.field}
                card={spotlightCards[1] ?? spotlightCards[0]}
                image={resourcePreview?.image ?? home.hero.backgroundImage}
                imageField={
                  resourcePreview
                    ? tinaField(resourcePreview, "image")
                    : tinaField(home.hero, "backgroundImage")
                }
                linkHref={home.hero.secondaryAction.href}
                reverse
              />
              <FeatureStory
                actionLabel={spotlightAction3.value}
                actionLabelField={spotlightAction3.field}
                card={spotlightCards[2] ?? spotlightCards[0]}
                image={stories[1]?.image ?? home.hero.backgroundImage}
                imageField={
                  stories[1]
                    ? tinaField(stories[1], "image")
                    : tinaField(home.hero, "backgroundImage")
                }
                linkHref={home.contactPanel.primaryAction.href}
                reverse={false}
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
                      <MockUiPreview compact />
                    </div>
                    <div className="rounded-md bg-[var(--site-surface-0)] p-3">
                      <MockUiPreview compact />
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

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {valueCards.map((card, index) => (
                <Reveal
                  as="article"
                  className="rounded-lg border border-[#dddddd] bg-white p-4"
                  delay={index * 0.08}
                  key={card.id}
                >
                  <div className="h-36 rounded-md border border-[#ececec] bg-gradient-to-br from-secondary/70 via-white to-accent/10">
                    <MockUiPreview compact />
                  </div>
                  <h3
                    className="text-site-strong mt-3 text-sm font-semibold"
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
              />
              <ValueCard
                title="Audit Trails"
                body="Immutable, queryable logs for compliance reviews."
                accent="from-secondary/70 via-white to-primary/12"
              />
              <ValueCard
                title="Predictable Costs"
                body="Reserve GPU seconds and cache embeddings to save money."
                accent="from-secondary/65 via-white to-accent/10"
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
            className="mx-auto mt-7 max-w-3xl rounded-lg border border-[#d7d7d7] bg-white p-4 shadow-[0_18px_28px_rgba(0,0,0,0.08)]"
          >
            <Image
              alt={workflowStory?.title ?? "Workflow preview"}
              className="h-[260px] w-full rounded-md border border-[#ececec] object-cover"
              data-tina-field={
                workflowStory
                  ? tinaField(workflowStory, "image")
                  : tinaField(home.hero, "backgroundImage")
              }
              height={860}
              src={workflowStory?.image ?? home.hero.backgroundImage}
              width={1320}
            />
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
        className="bg-[#f8f9fb] py-12"
        data-landing-slot="omnichannel"
        id="landing-slot-omnichannel"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="relative overflow-hidden rounded-xl border border-[#e8ebef] bg-white p-6 md:p-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_8%,rgba(84,126,232,0.14),transparent_40%)]" />

            <div className="relative grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
              <div>
                <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Omnichannel
                </p>
                <h3 className="text-site-strong mt-2 text-2xl font-semibold md:text-3xl">
                  Unified enforcement across channels
                </h3>
                <p
                  className="text-site-muted mt-3 text-sm leading-relaxed"
                  data-tina-field={omnichannelBody.field}
                >
                  {omnichannelBody.value}
                </p>
              </div>

              <div className="rounded-lg border border-[#e6edf4] bg-[linear-gradient(145deg,#f8fbff_0%,#fbfcff_56%,#ffffff_100%)] p-4">
                <MockWorkflowFrame />
              </div>
            </div>

            <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {omnichannelTiles.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-lg border border-[#ececec] bg-[#fbfbfd] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-[#eef2ff] p-2">
                      <tile.icon className="size-5 text-[#2b2b2b]" />
                    </div>
                    <div>
                      <p className="text-site-strong text-sm font-semibold">
                        {tile.title}
                      </p>
                      <p className="text-site-muted mt-1 text-xs">{tile.body}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-2 rounded-md border border-[#dfeaf8] bg-white px-2 py-1 text-[11px] font-semibold text-[#2b6cb0]">
                          Preview
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="rounded-md border border-[#eef3f8] p-2">
                      <MockUiPreview compact />
                    </div>
                  </div>
                </div>
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
        className="bg-white py-10"
        data-landing-slot="use-cases"
        id="landing-slot-use-cases"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#eef0f2] bg-white p-6 md:p-8"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                Use Cases
              </p>
              <h3 className="text-site-strong mt-2 text-2xl font-semibold">
                Real workflows that save time
              </h3>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg border border-[#ececec] p-4">
                <p className="text-sm font-semibold">Customer Support</p>
                <p className="text-site-muted mt-2 text-xs">
                  Automated triage and safe responses across channels.
                </p>
              </div>
              <div className="rounded-lg border border-[#ececec] p-4">
                <p className="text-sm font-semibold">Document Processing</p>
                <p className="text-site-muted mt-2 text-xs">
                  OCR, embeddings, and retrieval to extract value from
                  documents.
                </p>
              </div>
              <div className="rounded-lg border border-[#ececec] p-4">
                <p className="text-sm font-semibold">Image Generation</p>
                <p className="text-site-muted mt-2 text-xs">
                  High-volume, low-cost image pipelines with quality tiers.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Metrics / stats band */}
      <section
        className="bg-[var(--site-surface-0)] py-10 text-site-strong"
        data-landing-slot="metrics"
        id="landing-slot-metrics"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal as="div" className="text-center">
            <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
              Reliability Snapshot
            </p>
          </Reveal>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatBand label="Requests Served" value="1.2M+" />
            <StatBand label="Models" value="150+" />
            <StatBand label="Uptime" value="99.99%" />
            <StatBand label="Customers" value="300+" />
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
      <section
        className="bg-white py-10"
        data-landing-slot="pricing"
        id="landing-slot-pricing"
      >
        <div className="mx-auto max-w-7xl px-4">
          <Reveal
            as="div"
            className="rounded-xl border border-[#eef0f2] bg-white p-6 md:p-8"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-site-soft text-[11px] font-semibold uppercase tracking-[0.14em]">
                Pricing
              </p>
              <h3 className="text-site-strong mt-2 text-2xl font-semibold">
                Start with credits, scale with confidence
              </h3>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg border p-5">
                <p className="text-lg font-semibold">Starter</p>
                <p className="text-site-muted mt-2 text-sm">
                  Prepaid credits, limited models, great for early tests.
                </p>
              </div>
              <div className="rounded-lg border p-5">
                <p className="text-lg font-semibold">Pro</p>
                <p className="text-site-muted mt-2 text-sm">
                  Monthly plan with usage-based billing and priority support.
                </p>
              </div>
              <div className="rounded-lg border p-5">
                <p className="text-lg font-semibold">Enterprise</p>
                <p className="text-site-muted mt-2 text-sm">
                  Custom pricing, SSO, SLAs, and dedicated routing.
                </p>
              </div>
            </div>
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
          className="bg-[#ececec] py-10 md:py-14"
          data-landing-slot="contact-panel"
          data-tina-field={tinaField(home, "contactPanel")}
          id="landing-slot-contact-panel"
        >
          <div className="mx-auto max-w-7xl px-4">
            <Reveal
              as="div"
              className="text-site-inverse overflow-hidden rounded-[20px] border border-[#7fb5ef] bg-[linear-gradient(120deg,var(--cta-cool-a)_0%,var(--cta-cool-mid)_54%,var(--cta-cool-b)_100%)] p-6 md:p-10"
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                <div>
                  <p
                    className="text-site-inverse-soft text-[11px] font-semibold uppercase tracking-[0.16em]"
                    data-tina-field={tinaField(home.contactPanel, "kicker")}
                  >
                    {home.contactPanel.kicker}
                  </p>
                  <h2
                    className="mt-2 text-3xl leading-tight md:text-4xl"
                    data-tina-field={tinaField(home.contactPanel, "heading")}
                  >
                    {commandHeading.value}
                  </h2>
                  <p
                    className="text-site-inverse-muted mt-3 max-w-2xl text-sm leading-relaxed"
                    data-tina-field={tinaField(home.contactPanel, "body")}
                  >
                    {commandBody.value}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <ActionLink
                      action={home.contactPanel.primaryAction}
                      field={tinaField(home.contactPanel, "primaryAction")}
                      tone="dark"
                    />
                    <ActionLink
                      action={home.contactPanel.secondaryAction}
                      field={tinaField(home.contactPanel, "secondaryAction")}
                      tone="light"
                    />
                  </div>
                  <p
                    className="text-site-inverse-soft mt-4 text-[11px] uppercase tracking-[0.14em]"
                    data-tina-field={supportPrompt.field}
                  >
                    {supportPrompt.value}
                  </p>
                </div>

                <div className="rounded-xl border border-white/35 bg-white/16 p-4 backdrop-blur-sm">
                  <p className="text-site-inverse-soft text-[10px] uppercase tracking-[0.15em]">
                    Customer Note
                  </p>
                  <p className="text-site-inverse mt-2 text-sm leading-relaxed">
                    {testimonial ? (
                      <>
                        &ldquo;{testimonial.quote}&rdquo;
                        <span className="text-site-inverse-soft mt-2 block text-[11px] uppercase tracking-[0.14em]">
                          {testimonial.company} / {testimonial.role}
                        </span>
                      </>
                    ) : (
                      "\u201cWe shipped faster because one API let us test more models without rebuilding the client layer every time.\u201d"
                    )}
                  </p>
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
  image,
  imageField,
  linkHref,
  reverse,
}: {
  actionLabel: string;
  actionLabelField?: string;
  card?: HomeContent["spotlightCards"][number];
  image: string;
  imageField: string;
  linkHref: string;
  reverse: boolean;
}) {
  if (!card) {
    return null;
  }

  return (
    <Reveal
      as="article"
      className={`grid gap-5 rounded-lg border border-[#dddddd] bg-white p-4 md:p-5 ${reverse ? "lg:grid-cols-[1fr_0.95fr]" : "lg:grid-cols-[0.95fr_1fr]"}`}
    >
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="text-site-soft inline-flex items-center gap-2 rounded-full border border-[#dfdfdf] bg-[#f7f7f7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <SiteIcon className="text-site-strong size-3.5" icon={card.icon} />
          Section
        </p>
        <h3
          className="text-site-strong mt-3 text-2xl leading-tight"
          data-tina-field={tinaField(card, "title")}
        >
          {card.title}
        </h3>
        <p
          className="text-site-muted mt-3 text-sm leading-relaxed"
          data-tina-field={tinaField(card, "description")}
        >
          {card.description}
        </p>
        <QuoteAwareLink
          className="text-site-strong mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--site-surface-1)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:bg-[color:var(--site-text-strong)] hover:text-[color:var(--primary-foreground)]"
          href={linkHref}
          quoteLabel={actionLabel}
        >
          <span data-tina-field={actionLabelField}>{actionLabel}</span>
          <ArrowRight className="size-3.5" />
        </QuoteAwareLink>
      </div>

      <div className={reverse ? "lg:order-1" : ""}>
        <div className="h-full rounded-lg border border-[#ececec] bg-gradient-to-br from-secondary/70 via-white to-primary/10 p-3">
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

function MockUiPreview({ compact }: { compact?: boolean }) {
  return (
    <div className={`${compact ? "p-2" : "p-3"} h-full w-full`}>
      <div className="relative h-full rounded-md border border-[#e8eef3] bg-gradient-to-b from-white to-[#fbfdff] p-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="text-site-soft ml-auto text-[10px]">Preview</div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="h-6 w-3/4 rounded-md bg-[#eef6ff]" />
          <div className="h-6 w-full rounded-md bg-[#f1fbf5]" />
          <div className="h-6 w-5/6 rounded-md bg-[#f7f7f9]" />
        </div>

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <div className="h-2 w-8 rounded-full bg-[#d7e6ff]" />
          <div className="h-2 w-4 rounded-full bg-[#d8f0e0]" />
        </div>
      </div>
    </div>
  );
}

function ValueCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-[#ececec] p-5">
      <div
        className={`rounded-md p-3 ${"bg-gradient-to-br " + accent} border border-[#f3f3f3]`}
      >
        <MockUiPreview />
      </div>
      <h3 className="text-site-strong mt-4 text-lg font-semibold">{title}</h3>
      <p className="text-site-muted mt-2 text-sm">{body}</p>
    </div>
  );
}

function MockCodePanel() {
  return (
    <div className="text-site-strong text-xs font-mono">
      <div className="rounded-md bg-[var(--site-surface-0)] p-3">
        <div className="mb-2 h-3 w-24 rounded-full bg-[var(--site-surface-0)]" />
        <div className="space-y-1">
          <div className="h-3 w-full rounded bg-[var(--site-surface-0)]" />
          <div className="h-3 w-5/6 rounded bg-[var(--site-surface-0)]" />
          <div className="h-3 w-4/6 rounded bg-[var(--site-surface-0)]" />
        </div>
      </div>
    </div>
  );
}

function MockWorkflowFrame() {
  return (
    <div className="rounded-lg border border-[#eef3f8] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md border bg-gradient-to-br from-secondary/75 to-primary/15" />
          <div>
            <p className="text-sm font-semibold">Compose</p>
            <p className="text-site-muted text-xs">Message with policy check</p>
          </div>
        </div>
        <div className="text-site-muted text-xs">
          Enforced • <strong className="text-[#2b6cb0]">Policy: Safety</strong>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="h-10 rounded-md bg-[#f7fbff]" />
        <div className="h-10 rounded-md bg-[#f3fff6]" />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 w-32 rounded-full bg-[#dbeafe]" />
          <div className="h-2 w-20 rounded-full bg-[#dff6e9]" />
        </div>
      </div>
    </div>
  );
}

function StatBand({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/12 bg-white/4 px-4 py-3 text-center">
      <div className="text-site-strong text-2xl font-bold">{value}</div>
      <div className="text-site-muted mt-1 text-sm">{label}</div>
    </div>
  );
}
