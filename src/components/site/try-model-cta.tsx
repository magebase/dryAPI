import Link from "next/link"
import { Zap } from "lucide-react"

type TryModelCtaProps = {
  modelDisplayName: string
  playgroundHref: string
  className?: string
}

export function TryModelCta({ modelDisplayName, playgroundHref, className }: TryModelCtaProps) {
  return (
    <div className={`mx-auto max-w-6xl px-4 ${className ?? ""}`}>
      <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 sm:items-center">
          <Zap className="mt-0.5 size-4 shrink-0 text-orange-500 sm:mt-0" />
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-orange-700">{modelDisplayName}</span> is live on our API —{" "}
            <span className="text-slate-600">try it in the playground without setup.</span>
          </p>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:brightness-105 sm:self-auto"
          href={playgroundHref}
        >
          <Zap className="size-3.5" />
          Try {modelDisplayName}
        </Link>
      </div>
    </div>
  )
}
