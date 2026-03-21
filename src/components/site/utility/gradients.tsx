import type { CSSProperties } from "react"

export enum ModelCardGradientName {
  Hyper = "Hyper",
  Oceanic = "Oceanic",
  CottonCandy = "Cotton Candy",
  Gotham = "Gotham",
  Sunset = "Sunset",
  Mojave = "Mojave",
  Beachside = "Beachside",
  Gunmetal = "Gunmetal",
  Peachy = "Peachy",
  Seafoam = "Seafoam",
  Pumpkin = "Pumpkin",
  Pandora = "Pandora",
  Valentine = "Valentine",
  Hawaii = "Hawaii",
  Lavender = "Lavender",
  Wintergreen = "Wintergreen",
  Huckleberry = "Huckleberry",
  BlueSteel = "Blue Steel",
  Arendelle = "Arendelle",
  Spearmint = "Spearmint",
  Midnight = "Midnight",
  Borealis = "Borealis",
  Flamingo = "Flamingo",
  Emerald = "Emerald",
  Messenger = "Messenger",
  PurpleHaze = "Purple Haze",
  BigSur = "Big Sur",
  Oahu = "Oahu",
  RocketPower = "Rocket Power",
  BlueFlame = "Blue Flame",
  Azure = "Azure",
}

const MODEL_CARD_GRADIENTS: Record<ModelCardGradientName, string> = {
  [ModelCardGradientName.Hyper]:
    "linear-gradient(to right, #ec4899, #ef4444, #eab308)",
  [ModelCardGradientName.Oceanic]:
    "linear-gradient(to right, #86efac, #3b82f6, #9333ea)",
  [ModelCardGradientName.CottonCandy]:
    "linear-gradient(to right, #f9a8d4, #d8b4fe, #818cf8)",
  [ModelCardGradientName.Gotham]:
    "linear-gradient(to right, #374151, #111827, #000000)",
  [ModelCardGradientName.Sunset]:
    "linear-gradient(to right, #a5b4fc, #fca5a5, #fef3c7)",
  [ModelCardGradientName.Mojave]:
    "linear-gradient(to right, #fef3c7, #fcd34d, #eab308)",
  [ModelCardGradientName.Beachside]:
    "linear-gradient(to right, #fde68a, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Gunmetal]:
    "linear-gradient(to right, #e5e7eb, #9ca3af, #4b5563)",
  [ModelCardGradientName.Peachy]:
    "linear-gradient(to right, #fecaca, #fca5a5, #fde68a)",
  [ModelCardGradientName.Seafoam]:
    "linear-gradient(to right, #bbf7d0, #86efac, #3b82f6)",
  [ModelCardGradientName.Pumpkin]:
    "linear-gradient(to right, #fde68a, #facc15, #a16207)",
  [ModelCardGradientName.Pandora]:
    "linear-gradient(to right, #bbf7d0, #4ade80, #6d28d9)",
  [ModelCardGradientName.Valentine]:
    "linear-gradient(to right, #fecaca, #dc2626)",
  [ModelCardGradientName.Hawaii]:
    "linear-gradient(to right, #86efac, #fde047, #f9a8d4)",
  [ModelCardGradientName.Lavender]:
    "linear-gradient(to right, #a5b4fc, #c084fc)",
  [ModelCardGradientName.Wintergreen]:
    "linear-gradient(to right, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Huckleberry]:
    "linear-gradient(to right, #c4b5fd, #a855f7, #6b21a8)",
  [ModelCardGradientName.BlueSteel]:
    "linear-gradient(to right, #9ca3af, #4b5563, #1e3a8a)",
  [ModelCardGradientName.Arendelle]:
    "linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6)",
  [ModelCardGradientName.Spearmint]:
    "linear-gradient(to right, #bbf7d0, #4ade80, #22c55e)",
  [ModelCardGradientName.Midnight]:
    "linear-gradient(to right, #1d4ed8, #1e40af, #111827)",
  [ModelCardGradientName.Borealis]:
    "linear-gradient(to right, #86efac, #a78bfa)",
  [ModelCardGradientName.Flamingo]:
    "linear-gradient(to right, #f472b6, #db2777)",
  [ModelCardGradientName.Emerald]:
    "linear-gradient(to right, #10b981, #65a30d)",
  [ModelCardGradientName.Messenger]:
    "linear-gradient(to right, #38bdf8, #3b82f6)",
  [ModelCardGradientName.PurpleHaze]:
    "linear-gradient(to right, #6b21a8, #4c1d95, #6b21a8)",
  [ModelCardGradientName.BigSur]:
    "linear-gradient(to top right, #8b5cf6, #fdba74)",
  [ModelCardGradientName.Oahu]: "linear-gradient(to top, #fb923c, #38bdf8)",
  [ModelCardGradientName.RocketPower]:
    "radial-gradient(ellipse at top, #b45309, #fdba74, #9f1239)",
  [ModelCardGradientName.BlueFlame]:
    "radial-gradient(ellipse at bottom, #fde68a, #7c3aed, #0c4a6e)",
  [ModelCardGradientName.Azure]:
    "linear-gradient(to right, #0f172a, #1e3a8a, #1d4ed8)",
}

const MODEL_CARD_HARMONIC_ROWS: [
  ModelCardGradientName,
  ModelCardGradientName,
  ModelCardGradientName,
][] = [
  [
    ModelCardGradientName.Sunset,
    ModelCardGradientName.Arendelle,
    ModelCardGradientName.Lavender,
  ],
  [
    ModelCardGradientName.Peachy,
    ModelCardGradientName.Seafoam,
    ModelCardGradientName.CottonCandy,
  ],
  [
    ModelCardGradientName.Mojave,
    ModelCardGradientName.Spearmint,
    ModelCardGradientName.Huckleberry,
  ],
  [
    ModelCardGradientName.Pumpkin,
    ModelCardGradientName.Wintergreen,
    ModelCardGradientName.PurpleHaze,
  ],
  [
    ModelCardGradientName.Oahu,
    ModelCardGradientName.Messenger,
    ModelCardGradientName.BigSur,
  ],
  [
    ModelCardGradientName.Hyper,
    ModelCardGradientName.Oceanic,
    ModelCardGradientName.BlueFlame,
  ],
  [
    ModelCardGradientName.Valentine,
    ModelCardGradientName.Emerald,
    ModelCardGradientName.Midnight,
  ],
  [
    ModelCardGradientName.RocketPower,
    ModelCardGradientName.Pandora,
    ModelCardGradientName.Gotham,
  ],
  [
    ModelCardGradientName.Gunmetal,
    ModelCardGradientName.Beachside,
    ModelCardGradientName.BlueSteel,
  ],
  [
    ModelCardGradientName.Hawaii,
    ModelCardGradientName.Borealis,
    ModelCardGradientName.Flamingo,
  ],
]

type GradientPreset = {
  name: ModelCardGradientName
  background: string
}

export function getModelCardGradientPreset(seed: number): GradientPreset {
  const rowIndex = Math.floor(seed / 3)
  const columnIndex = seed % 3
  const harmonicRow = MODEL_CARD_HARMONIC_ROWS[rowIndex % MODEL_CARD_HARMONIC_ROWS.length]
  const gradientName = harmonicRow[columnIndex]

  return {
    name: gradientName,
    background: MODEL_CARD_GRADIENTS[gradientName],
  }
}

const DASHBOARD_ANNOUNCEMENT_GRADIENTS: ModelCardGradientName[] = [
  ModelCardGradientName.Azure,
  ModelCardGradientName.Messenger,
  ModelCardGradientName.BlueSteel,
  ModelCardGradientName.Midnight,
  ModelCardGradientName.Arendelle,
]

export function getDashboardAnnouncementGradient(seed: number): GradientPreset {
  const normalizedSeed = Math.abs(Math.round(seed))
  const gradientName = DASHBOARD_ANNOUNCEMENT_GRADIENTS[
    normalizedSeed % DASHBOARD_ANNOUNCEMENT_GRADIENTS.length
  ]

  return {
    name: gradientName,
    background: MODEL_CARD_GRADIENTS[gradientName],
  }
}

export function getGrainOverlayStyle(opacity = 0.24): CSSProperties {
  return {
    opacity,
    backgroundImage: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 3px)",
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.11) 0px, rgba(0,0,0,0.11) 1px, transparent 1px, transparent 2px)",
    ].join(","),
    backgroundSize: "150px 150px, 110px 110px",
    mixBlendMode: "overlay",
  }
}
