import type { OgTemplateKind } from "@/lib/og/metadata"

type GradientPalette = {
  start: string
  middle: string
  end: string
  glowA: string
  glowB: string
}

type ContrastPalette = {
  textPrimary: string
  textSecondary: string
  chipBackground: string
  chipText: string
  divider: string
}

export type TakumiTemplatePayload = {
  template: OgTemplateKind
  title: string
  description: string
  label: string
  path: string
  brand: string
  seed: string
}

const TEMPLATE_GRADIENTS: Record<OgTemplateKind, GradientPalette[]> = {
  marketing: [
    {
      start: "#f7644c",
      middle: "#f9a66f",
      end: "#f5d7bf",
      glowA: "rgba(255, 255, 255, 0.48)",
      glowB: "rgba(252, 76, 47, 0.24)",
    },
    {
      start: "#f55153",
      middle: "#fb8d73",
      end: "#f9c9a9",
      glowA: "rgba(255, 255, 255, 0.42)",
      glowB: "rgba(254, 126, 89, 0.26)",
    },
    {
      start: "#ec6848",
      middle: "#f5ab6f",
      end: "#e9d2b5",
      glowA: "rgba(255, 255, 255, 0.38)",
      glowB: "rgba(236, 104, 72, 0.24)",
    },
  ],
  pricing: [
    {
      start: "#0f345c",
      middle: "#2f5ca1",
      end: "#9cc4ff",
      glowA: "rgba(255, 255, 255, 0.22)",
      glowB: "rgba(116, 170, 255, 0.26)",
    },
    {
      start: "#18395f",
      middle: "#355aa5",
      end: "#9ab2ff",
      glowA: "rgba(255, 255, 255, 0.2)",
      glowB: "rgba(104, 130, 255, 0.24)",
    },
    {
      start: "#17345e",
      middle: "#1e6ba4",
      end: "#a6d3f8",
      glowA: "rgba(255, 255, 255, 0.2)",
      glowB: "rgba(63, 148, 244, 0.26)",
    },
  ],
  dashboard: [
    {
      start: "#111827",
      middle: "#2a3656",
      end: "#5a7098",
      glowA: "rgba(153, 175, 255, 0.2)",
      glowB: "rgba(48, 71, 120, 0.4)",
    },
    {
      start: "#0d1f33",
      middle: "#293f65",
      end: "#5d7fa8",
      glowA: "rgba(130, 183, 255, 0.22)",
      glowB: "rgba(41, 63, 101, 0.38)",
    },
    {
      start: "#1a2038",
      middle: "#30406c",
      end: "#6987b1",
      glowA: "rgba(180, 164, 255, 0.18)",
      glowB: "rgba(57, 83, 128, 0.42)",
    },
  ],
  blog: [
    {
      start: "#2a1f1f",
      middle: "#5a2d2d",
      end: "#c7825c",
      glowA: "rgba(255, 228, 210, 0.26)",
      glowB: "rgba(255, 170, 120, 0.24)",
    },
    {
      start: "#1e2732",
      middle: "#3a4a63",
      end: "#8a9fc1",
      glowA: "rgba(205, 223, 255, 0.24)",
      glowB: "rgba(122, 162, 232, 0.2)",
    },
    {
      start: "#2d2a1e",
      middle: "#6b5932",
      end: "#cab97a",
      glowA: "rgba(255, 246, 214, 0.24)",
      glowB: "rgba(244, 214, 120, 0.22)",
    },
  ],
}

function hashString(input: string): number {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }

  return hash
}

function parseHexChannel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16)
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "")

  if (normalized.length !== 6) {
    return [255, 255, 255]
  }

  return [
    parseHexChannel(normalized, 0),
    parseHexChannel(normalized, 2),
    parseHexChannel(normalized, 4),
  ]
}

function toLinearSrgb(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex)

  return (
    0.2126 * toLinearSrgb(red)
    + 0.7152 * toLinearSrgb(green)
    + 0.0722 * toLinearSrgb(blue)
  )
}

function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const foreground = luminance(foregroundHex)
  const background = luminance(backgroundHex)

  const light = Math.max(foreground, background)
  const dark = Math.min(foreground, background)

  return (light + 0.05) / (dark + 0.05)
}

function minContrastForText(textHex: string, stopHexColors: string[]): number {
  return stopHexColors.reduce((currentMin, stop) => {
    return Math.min(currentMin, contrastRatio(textHex, stop))
  }, Number.POSITIVE_INFINITY)
}

export function pickAccessibleTextPalette(stopHexColors: string[]): ContrastPalette {
  const lightPrimary = "#f8fafc"
  const darkPrimary = "#0f172a"

  const lightContrast = minContrastForText(lightPrimary, stopHexColors)
  const darkContrast = minContrastForText(darkPrimary, stopHexColors)

  if (darkContrast >= lightContrast) {
    return {
      textPrimary: "#0b1220",
      textSecondary: "rgba(11, 18, 32, 0.74)",
      chipBackground: "rgba(255, 255, 255, 0.6)",
      chipText: "#111827",
      divider: "rgba(17, 24, 39, 0.2)",
    }
  }

  return {
    textPrimary: "#f8fafc",
    textSecondary: "rgba(241, 245, 249, 0.84)",
    chipBackground: "rgba(2, 6, 23, 0.34)",
    chipText: "#f8fafc",
    divider: "rgba(226, 232, 240, 0.25)",
  }
}

function resolveGradient(template: OgTemplateKind, seed: string): GradientPalette {
  const palettes = TEMPLATE_GRADIENTS[template]
  const index = hashString(`${template}:${seed}`) % palettes.length
  return palettes[index]
}

function renderBackground(gradient: GradientPalette, seed: string) {
  const diagonalOffset = hashString(seed) % 17
  const secondaryOffset = (diagonalOffset + 90) % 360

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: [
          `linear-gradient(${diagonalOffset}deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 48%)`,
          `linear-gradient(${secondaryOffset}deg, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0) 46%)`,
          `radial-gradient(circle at 22% 18%, ${gradient.glowA} 0%, rgba(255,255,255,0) 45%)`,
          `radial-gradient(circle at 78% 82%, ${gradient.glowB} 0%, rgba(0,0,0,0) 52%)`,
          `linear-gradient(140deg, ${gradient.start} 0%, ${gradient.middle} 52%, ${gradient.end} 100%)`,
        ].join(", "),
      }}
    />
  )
}

function renderLabelRow(input: TakumiTemplatePayload, contrast: ContrastPalette) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 18px",
          borderRadius: "999px",
          backgroundColor: contrast.chipBackground,
          color: contrast.chipText,
          fontSize: 22,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {input.label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: contrast.textSecondary,
          fontSize: 20,
          letterSpacing: "0.06em",
          maxWidth: "55%",
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {input.path}
      </div>
    </div>
  )
}

function renderMarketingTemplate(input: TakumiTemplatePayload, contrast: ContrastPalette) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "54px 62px",
        position: "relative",
        justifyContent: "space-between",
      }}
    >
      {renderLabelRow(input, contrast)}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "92%",
          textWrap: "pretty",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 86,
            lineHeight: 1.06,
            letterSpacing: "-0.04em",
            fontWeight: 800,
            color: contrast.textPrimary,
          }}
        >
          {input.title}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 34,
            lineHeight: 1.32,
            color: contrast.textSecondary,
            maxWidth: "96%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {input.description}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: contrast.textPrimary,
        }}
      >
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{input.brand}</span>
        <span style={{ fontSize: 22, color: contrast.textSecondary, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Unified AI Inference
        </span>
      </div>
    </div>
  )
}

function renderPricingTemplate(input: TakumiTemplatePayload, contrast: ContrastPalette) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "54px 62px",
        position: "relative",
        justifyContent: "space-between",
      }}
    >
      {renderLabelRow(input, contrast)}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "28px", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1.2 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 72,
              lineHeight: 1.08,
              letterSpacing: "-0.04em",
              fontWeight: 800,
              color: contrast.textPrimary,
            }}
          >
            {input.title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 31,
              lineHeight: 1.28,
              color: contrast.textSecondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {input.description}
          </p>
        </div>
        <div
          style={{
            width: 360,
            borderRadius: 22,
            border: `1px solid ${contrast.divider}`,
            backgroundColor: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(6px)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <span style={{ color: contrast.textSecondary, fontSize: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Pricing Snapshot
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ color: contrast.textPrimary, fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em" }}>$0.00</span>
            <span style={{ color: contrast.textSecondary, fontSize: 22 }}>to peak tier</span>
          </div>
          <div style={{ width: "100%", height: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)" }}>
            <div style={{ width: "68%", height: "100%", borderRadius: 999, backgroundColor: contrast.textPrimary }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: contrast.textPrimary }}>{input.brand}</span>
        <span style={{ fontSize: 22, color: contrast.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Pricing Intelligence
        </span>
      </div>
    </div>
  )
}

function renderDashboardTemplate(input: TakumiTemplatePayload, contrast: ContrastPalette) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "54px 62px",
        position: "relative",
        justifyContent: "space-between",
      }}
    >
      {renderLabelRow(input, contrast)}
      <div style={{ display: "flex", gap: "24px", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1.3 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 72,
              lineHeight: 1.06,
              letterSpacing: "-0.04em",
              fontWeight: 800,
              color: contrast.textPrimary,
            }}
          >
            {input.title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.28,
              color: contrast.textSecondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {input.description}
          </p>
        </div>
        <div style={{ width: 370, display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            "Routes healthy across model gateways",
            "Credit balances synced with billing",
            "Rate limits active at edge",
          ].map((line) => (
            <div
              key={line}
              style={{
                borderRadius: 18,
                border: `1px solid ${contrast.divider}`,
                backgroundColor: "rgba(15, 23, 42, 0.24)",
                padding: "14px 16px",
                color: contrast.textSecondary,
                fontSize: 20,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: contrast.textPrimary }}>{input.brand}</span>
        <span style={{ fontSize: 22, color: contrast.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Dashboard Surface
        </span>
      </div>
    </div>
  )
}

function renderBlogTemplate(input: TakumiTemplatePayload, contrast: ContrastPalette) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "54px 62px",
        position: "relative",
        justifyContent: "space-between",
      }}
    >
      {renderLabelRow(input, contrast)}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "94%" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 74,
            lineHeight: 1.07,
            letterSpacing: "-0.04em",
            fontWeight: 800,
            color: contrast.textPrimary,
          }}
        >
          {input.title}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.3,
            color: contrast.textSecondary,
            maxWidth: "96%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {input.description}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: contrast.textPrimary }}>{input.brand}</span>
        <span style={{ fontSize: 22, color: contrast.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Editorial Insights
        </span>
      </div>
    </div>
  )
}

export function renderTakumiOgTemplate(input: TakumiTemplatePayload) {
  const gradient = resolveGradient(input.template, input.seed)
  const contrast = pickAccessibleTextPalette([gradient.start, gradient.middle, gradient.end])

  let body

  if (input.template === "pricing") {
    body = renderPricingTemplate(input, contrast)
  } else if (input.template === "dashboard") {
    body = renderDashboardTemplate(input, contrast)
  } else if (input.template === "blog") {
    body = renderBlogTemplate(input, contrast)
  } else {
    body = renderMarketingTemplate(input, contrast)
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, ui-sans-serif, system-ui",
      }}
    >
      {renderBackground(gradient, input.seed)}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `1px solid ${contrast.divider}`,
          margin: "16px",
          borderRadius: "22px",
        }}
      />
      {body}
    </div>
  )
}
