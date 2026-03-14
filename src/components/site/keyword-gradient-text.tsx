type KeywordGradientTextProps = {
  text: string
  dataTinaField?: string
  seed?: number
  maxHighlights?: number
  forceFullGradient?: boolean
}
export function KeywordGradientText({ text, dataTinaField, forceFullGradient = false }: KeywordGradientTextProps) {
  return (
    <span className={forceFullGradient ? "text-[#7ae8d9]" : undefined} data-tina-field={dataTinaField}>
      {text}
    </span>
  )
}
