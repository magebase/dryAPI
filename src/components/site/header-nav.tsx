"use client"

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
          className="text-left text-sm font-semibold tracking-wide"
          onClick={() => scrollToSection("top")}
          type="button"
        >
          {companyName}
        </button>
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Button
              key={link.id}
              onClick={() => scrollToSection(link.href)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {link.label}
            </Button>
          ))}
        </nav>
        <Button onClick={() => scrollToSection("contact")} size="sm" type="button">
          Contact
        </Button>
      </div>
    </header>
  )
}
