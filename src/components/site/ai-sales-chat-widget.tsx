"use client"

import { Loader2, MessageCircle, Send, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { openQuoteDialog } from "@/components/site/quote-dialog"
import { TurnstileWidget } from "@/components/site/turnstile-widget"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  showQuoteButton?: boolean
}

type ChatApiResponse = {
  ok: boolean
  answer?: string
  showQuoteButton?: boolean
  escalated?: boolean
  requiresTurnstile?: boolean
}

const SESSION_WELCOME_KEY = "genfix-chat-welcome-v1"
const VISITOR_KEY = "genfix-chat-visitor-v1"
const WELCOME_DELAY_MS = 30_000

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function readOrCreateVisitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_KEY)
  if (existing && existing.trim().length > 0) {
    return existing
  }

  const nextId = `visitor-${crypto.randomUUID()}`
  window.localStorage.setItem(VISITOR_KEY, nextId)
  return nextId
}

export function AiSalesChatWidget({ pathname }: { pathname: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [visitorId, setVisitorId] = useState("anonymous")
  const [escalationSent, setEscalationSent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [showTurnstile, setShowTurnstile] = useState(false)
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)

  const greeting = useMemo(
    () => ({
      id: createMessageId(),
      role: "assistant" as const,
      content: "How can I help?",
    }),
    []
  )

  useEffect(() => {
    setVisitorId(readOrCreateVisitorId())

    const hasWelcomed = window.sessionStorage.getItem(SESSION_WELCOME_KEY) === "true"
    if (hasWelcomed) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessages((current) => {
        if (current.length > 0) {
          return current
        }
        return [greeting]
      })
      setIsOpen(true)
      window.sessionStorage.setItem(SESSION_WELCOME_KEY, "true")
    }, WELCOME_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [greeting])

  function ensureGreeting() {
    setMessages((current) => {
      if (current.length > 0) {
        return current
      }
      return [greeting]
    })
  }

  async function sendMessage() {
    const trimmed = inputValue.trim()
    if (!trimmed || isSending) {
      return
    }

    if (showTurnstile && turnstileEnabled && !turnstileToken) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Please complete the verification challenge before sending more messages.",
        },
      ])
      return
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
    }

    const nextConversation = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }))

    setMessages((current) => [...current, userMessage])
    setInputValue("")
    setIsSending(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextConversation,
          pagePath: pathname,
          visitorId,
          allowEscalation: !escalationSent,
          turnstileToken,
        }),
      })

      const body = (await response.json()) as ChatApiResponse
      const fallbackText = "I can help with generator hire, sales, and service options. Tell me your timeline and site details."

      if (response.status === 429 && body.requiresTurnstile) {
        setShowTurnstile(true)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            content: "You have sent several messages quickly. Please complete the verification challenge to continue.",
          },
        ])
        return
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: body.ok ? body.answer || fallbackText : fallbackText,
          showQuoteButton: body.ok ? Boolean(body.showQuoteButton) : false,
        },
      ])

      if (body.escalated) {
        setEscalationSent(true)
      }

      if (showTurnstile) {
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: "I could not reach the assistant right now. Please try again, or use the quote form for immediate follow-up.",
          showQuoteButton: true,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close GenFix assistant" : "Open GenFix assistant"}
        className="fixed bottom-4 right-4 z-[120] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#ffb67f]/40 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] text-white shadow-[0_14px_28px_rgba(255,116,38,0.38)] transition hover:brightness-110"
        onClick={() => {
          setIsOpen((current) => !current)
          ensureGreeting()
        }}
        type="button"
      >
        {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {isOpen ? (
        <section className="fixed bottom-20 right-2 z-[120] flex h-[min(36rem,72vh)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0d1828]/96 shadow-[0_16px_45px_rgba(0,0,0,0.48)] backdrop-blur md:bottom-24 md:right-4">
          <header className="border-b border-white/10 bg-[#101a28] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#ff8b2b]">GenFix AI Assistant</p>
            <p className="mt-1 text-sm text-slate-200">Fast answers for generator hire, sales, and support.</p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "mr-7 border border-[#ff8b2b]/35 bg-[#132238] text-slate-100"
                    : "ml-7 bg-[#ff8b2b] text-white"
                }`}
                key={message.id}
              >
                <p className="whitespace-pre-line">{message.content}</p>
                {message.showQuoteButton ? (
                  <button
                    className="mt-3 inline-flex rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:brightness-110"
                    onClick={() => {
                      openQuoteDialog()
                    }}
                    type="button"
                  >
                    Get A Quote
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-[#101a28] p-3">
            {showTurnstile && turnstileEnabled ? (
              <div className="mb-2">
                <TurnstileWidget
                  action="chat_frequent"
                  className="min-h-[65px]"
                  onTokenChange={setTurnstileToken}
                  resetKey={turnstileResetKey}
                />
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-md border border-white/20 bg-[#0d1828] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#ff8b2b]"
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask about pricing, runtime, logistics, or service support"
                rows={2}
                value={inputValue}
              />
              <button
                aria-label="Send message"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#ff8b2b] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending}
                onClick={() => {
                  void sendMessage()
                }}
                type="button"
              >
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
