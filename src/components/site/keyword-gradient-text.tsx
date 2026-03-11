import type { CSSProperties } from "react"

import theme from "@/theme.json"

type KeywordGradientTextProps = {
  text: string
  dataTinaField?: string
  seed?: number
  maxHighlights?: number
}

type ThemeGradient = {
  id: string
  css: string
}

type ThemeKeywordText = {
  keywords: string[]
  gradients: ThemeGradient[]
}

const keywordTheme = theme.keywordText as ThemeKeywordText
const keywords = [...new Set(keywordTheme.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))].sort(
  (left, right) => right.length - left.length
)
const keywordSet = new Set(keywords)
const keywordPattern = keywords.map((keyword) => escapeRegExp(keyword)).join("|")
const keywordRegex = keywordPattern.length > 0 ? new RegExp(`\\b(${keywordPattern})\\b`, "gi") : null

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")
}

function buildKeywordStyle(gradientCss: string): CSSProperties {
  return {
    backgroundImage: gradientCss,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  }
}

export function KeywordGradientText({ text, dataTinaField, seed = 0, maxHighlights = 1 }: KeywordGradientTextProps) {
  const gradients = keywordTheme.gradients
  const highlightLimit = Math.max(0, Math.floor(maxHighlights))

  if (!text.trim() || !keywordRegex || gradients.length === 0 || highlightLimit === 0) {
    return <span data-tina-field={dataTinaField}>{text}</span>
  }

  const parts = text.split(keywordRegex)
  const baseIndex = Math.abs(seed) % gradients.length
  let highlightedWords = 0

  return (
    <span data-tina-field={dataTinaField}>
      {parts.map((part, index) => {
        const normalizedPart = part.toLowerCase()

        if (!keywordSet.has(normalizedPart)) {
          return <span key={`plain-${index}`}>{part}</span>
        }

        if (highlightedWords >= highlightLimit) {
          return <span key={`plain-${index}`}>{part}</span>
        }

        const gradient = gradients[(baseIndex + highlightedWords) % gradients.length]
        highlightedWords += 1

        return (
          <span className="bg-clip-text text-transparent" key={`keyword-${index}`} style={buildKeywordStyle(gradient.css)}>
            {part}
          </span>
        )
      })}
    </span>
  )
}
