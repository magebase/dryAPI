type KeywordGradientTextProps = {
  text: string
  dataTinaField?: string
  seed?: number
  maxHighlights?: number
  forceFullGradient?: boolean
}
export function KeywordGradientText({ text, dataTinaField, forceFullGradient = false }: KeywordGradientTextProps) {
  return (
    <span className={forceFullGradient ? "text-[#ffbf8a]" : undefined} data-tina-field={dataTinaField}>
      {text}
    </span>
  )
}
