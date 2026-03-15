"use client"

import { Bot, ChevronRight, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type HeaderNavProps = {
  companyName: string
  links: Array<{
    id: string
    label: string
    href: string
  }>
}

function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId)

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }
}

export function HeaderNav({ companyName, links }: HeaderNavProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button
          className="inline-flex items-center gap-2 text-left text-sm font-semibold tracking-wide"
          onClick={() => scrollToSection("top")}
          type="button"
        >
          <Bot className="size-4" />
          <span>{companyName}</span>
        </button>
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Button
              className="gap-1.5"
              key={link.id}
              onClick={() => scrollToSection(link.href)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span>{link.label}</span>
              <ChevronRight className="size-3.5" />
            </Button>
          ))}
        </nav>
        <Button className="gap-1.5" onClick={() => scrollToSection("contact")} size="sm" type="button">
          <MessageCircle className="size-4" />
          <span>Contact</span>
        </Button>
      </div>
    </header>
  )
}
