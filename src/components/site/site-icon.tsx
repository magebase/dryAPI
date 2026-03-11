import {
  Bolt,
  Factory,
  HardHat,
  Plug,
  Radio,
  Settings,
  Shield,
  Sun,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  wrench: Wrench,
  truck: Truck,
  shield: Shield,
  settings: Settings,
  bolt: Bolt,
  plug: Plug,
  factory: Factory,
  "hard-hat": HardHat,
  radio: Radio,
  sun: Sun,
}

export function SiteIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon] ?? Wrench
  return <Icon className={className} />
}
