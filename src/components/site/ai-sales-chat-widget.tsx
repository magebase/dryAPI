"use client"

import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { chatRequestSchema } from "@/lib/input-validation-schemas"
import { submitChatContactCaptureAction } from "@/app/actions/submit-chat-contact-capture-action"
import { openQuoteDialog } from "@/components/site/quote-dialog"
import { TurnstileWidget } from "@/components/site/turnstile-widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  createdAt: number
  role: "assistant" | "user"
  content: string
  showQuoteButton?: boolean
  isError?: boolean
}

type ChatApiResponse = {
  ok: boolean
  answer?: string
  error?: string
  showQuoteButton?: boolean
  escalated?: boolean
  needsContactCapture?: boolean
  requiresTurnstile?: boolean
}

const SESSION_WELCOME_KEY = "dryapi-chat-welcome-v1"
const VISITOR_KEY = "dryapi-chat-visitor-v1"
const WELCOME_DELAY_MS = 30_000
const SERVICE_HOURS_LABEL = "Coverage hours: Mon-Fri 8AM-6PM UTC"
const AVERAGE_REPLY_TIME_LABEL = "Average reply: 2 minutes"

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createChatMessage(input: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  return {
    id: createMessageId(),
    createdAt: Date.now(),
    ...input,
  }
}

function formatMessageTimestamp(value: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace("am", "AM")
    .replace("pm", "PM")
}

function shouldRenderTimestamp(messages: ChatMessage[], index: number): boolean {
  const current = messages[index]
  const next = messages[index + 1]

  if (!next) {
    return true
  }

  if (current.role !== next.role) {
    return true
  }

  const currentMinute = Math.floor(current.createdAt / 60_000)
  const nextMinute = Math.floor(next.createdAt / 60_000)
  return currentMinute !== nextMinute
}

function getSupportPresence(now = new Date()): { isOnline: boolean; label: string } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now)

  const weekday = parts.find((part) => part.type === "weekday")?.value || "Mon"
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value || "0", 10)
  const isBusinessDay = weekday !== "Sat" && weekday !== "Sun"
  const isOnline = isBusinessDay && hour >= 8 && hour < 18

  return {
    isOnline,
    label: isOnline
      ? "Support engineer online"
      : "Support offline. Leave a message and we will follow up by email.",
  }
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <Avatar
      className={cn(
        "size-9 shrink-0 rounded-full border border-primary/45 bg-black p-[2px] shadow-[0_10px_24px_rgba(0,0,0,0.38)]",
        className
      )}
    >
      <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-secondary via-primary to-accent text-primary-foreground">
        <Bot className="size-[17px] stroke-[2.15]" />
      </AvatarFallback>
    </Avatar>
  )
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
  const [chatStatusMessage, setChatStatusMessage] = useState("")
  const [needsContactCapture, setNeedsContactCapture] = useState(false)
  const [captureEmail, setCaptureEmail] = useState("")
  const [capturePhone, setCapturePhone] = useState("")
  const [captureStatus, setCaptureStatus] = useState("")
  const [isSubmittingCapture, setIsSubmittingCapture] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const supportPresence = getSupportPresence()

  const greeting = useMemo(
    () =>
      createChatMessage({
        role: "assistant",
        content:
          "Hi, I am the dryAPI assistant. I can help with model selection, pricing, API integration, and usage controls.",
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

  function sendQuickPrompt(prompt: string) {
    ensureGreeting()
    void sendMessage(prompt)
  }

  async function sendMessage(overrideInput?: string) {
    const trimmed = (overrideInput ?? inputValue).trim()
    if (!trimmed || isSending) {
      return
    }

    setChatStatusMessage("")
    setCaptureStatus("")
    setInputValue("")

    if (showTurnstile && turnstileEnabled && !turnstileToken) {
      const verificationMessage = "Please complete the verification challenge before sending more messages."
      setChatStatusMessage(verificationMessage)
      setMessages((current) => [
        ...current,
        createChatMessage({
          role: "assistant",
          content: verificationMessage,
          isError: true,
        }),
      ])
      return
    }

    const userMessage: ChatMessage = createChatMessage({
      role: "user",
      content: trimmed,
    })

    const nextConversation = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }))

    const parsedRequest = chatRequestSchema.safeParse({
      messages: nextConversation,
      pagePath: pathname,
      visitorId,
      allowEscalation: !escalationSent,
      turnstileToken,
    })

    if (!parsedRequest.success) {
      const errorMessage = parsedRequest.error.issues[0]?.message || "I could not process your request right now."
      setChatStatusMessage(errorMessage)
      setMessages((current) => [
        ...current,
        createChatMessage({
          role: "assistant",
          content: errorMessage,
          showQuoteButton: true,
          isError: true,
        }),
      ])
      return
    }

    setMessages((current) => [...current, userMessage])
    setIsSending(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedRequest.data),
      })

      let body: ChatApiResponse
      try {
        body = (await response.json()) as ChatApiResponse
      } catch {
        body = {
          ok: false,
          error: "The assistant returned an unreadable response.",
        }
      }
      const fallbackText =
        "I can help with dryAPI pricing, model selection, API compatibility, and production rollout guidance."

      if (response.status === 429 && body.requiresTurnstile) {
        setShowTurnstile(true)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
        setChatStatusMessage(body.error || "Please complete the verification challenge to continue chatting.")
        setMessages((current) => [
          ...current,
          createChatMessage({
            role: "assistant",
            content: body.error || "You have sent several messages quickly. Please complete the verification challenge to continue.",
            isError: true,
          }),
        ])
        return
      }

      if (!response.ok || !body.ok) {
        const errorMessage = body.error || "I could not process your request right now. Please try again in a moment."
        setChatStatusMessage(errorMessage)
        setNeedsContactCapture(false)
        setMessages((current) => [
          ...current,
          createChatMessage({
            role: "assistant",
            content: errorMessage,
            showQuoteButton: true,
            isError: true,
          }),
        ])
        return
      }

      setMessages((current) => [
        ...current,
        createChatMessage({
          role: "assistant",
          content: body.ok ? body.answer || fallbackText : fallbackText,
          showQuoteButton: body.ok ? Boolean(body.showQuoteButton) : false,
        }),
      ])

      if (body.escalated) {
        setEscalationSent(true)
      }

      setNeedsContactCapture(Boolean(body.needsContactCapture))

      if (showTurnstile) {
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
      }
    } catch {
      const errorMessage = "I could not reach the assistant right now. Please try again, or use the quote form for immediate follow-up."
      setChatStatusMessage(errorMessage)
      setMessages((current) => [
        ...current,
        createChatMessage({
          role: "assistant",
          content: errorMessage,
          showQuoteButton: true,
          isError: true,
        }),
      ])
    } finally {
      setIsSending(false)
    }
  }

  async function submitContactCapture() {
    if (isSubmittingCapture) {
      return
    }

    const email = captureEmail.trim()
    const phone = capturePhone.trim()

    const parsedRequest = chatRequestSchema.safeParse({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      pagePath: pathname,
      visitorId,
      allowEscalation: true,
      contactCapture: {
        email,
        phone,
      },
    })

    if (!parsedRequest.success) {
      const message = parsedRequest.error.issues[0]?.message || "Please check the contact details and try again."
      setCaptureStatus(message)
      toast.error("Contact details invalid", {
        description: message,
      })
      return
    }

    setIsSubmittingCapture(true)
    setCaptureStatus("")

    try {
      const result = await submitChatContactCaptureAction(parsedRequest.data)

      if (result?.validationErrors) {
        const message = "Please check the contact details and try again."
        setCaptureStatus(message)
        toast.error("Contact details invalid", {
          description: message,
        })
        return
      }

      if (result?.serverError || !result?.data?.ok) {
        const message = result?.serverError || result?.data?.error || "Unable to send contact details right now."
        setCaptureStatus(message)
        toast.error("Unable to send contact details", {
          description: message,
        })
        return
      }

      const body = result.data

      setMessages((current) => [
        ...current,
        createChatMessage({
          role: "assistant",
          content: body.answer || "Thanks. I have passed your contact details to the team.",
        }),
      ])

      setCaptureEmail("")
      setCapturePhone("")
      setNeedsContactCapture(false)
      setCaptureStatus("")
      toast.success("Contact details sent", {
        description: "Our team will follow up shortly.",
      })
      if (body.escalated) {
        setEscalationSent(true)
      }
    } catch {
      const message = "Unable to send contact details right now."
      setCaptureStatus(message)
      toast.error("Unable to send contact details", {
        description: message,
      })
    } finally {
      setIsSubmittingCapture(false)
    }
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close dryAPI assistant" : "Open dryAPI assistant"}
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-blue-300/70 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white shadow-[0_14px_32px_rgba(37,99,235,0.42)] ring-1 ring-blue-200/70 transition hover:scale-[1.03] hover:brightness-110"
        onClick={() => {
          setIsOpen((current) => !current)
          ensureGreeting()
        }}
        type="button"
      >
        {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {isOpen ? (
        <section className="fixed bottom-20 right-2 z-40 flex h-[min(38rem,74vh)] w-[min(25rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:bottom-24 md:right-4">
          <header className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-blue-700">dryAPI Assistant</p>
            <p className="mt-1 text-sm text-slate-700">Fast answers on models, pricing, API compatibility, and deployment.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                  supportPresence.isOnline
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-slate-100 text-slate-700"
                )}
              >
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    supportPresence.isOnline ? "bg-emerald-500" : "bg-slate-400"
                  )}
                />
                {supportPresence.label}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-700">
                {AVERAGE_REPLY_TIME_LABEL}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{SERVICE_HOURS_LABEL}</p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-3 py-3">
            {messages.length <= 1 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <p className="text-xs text-slate-700">Pick the fastest path:</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-600 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                    onClick={() => {
                      sendQuickPrompt("How does dryAPI pricing and credit usage work across models?")
                    }}
                    type="button"
                  >
                    Pricing & Credits
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-site-strong transition hover:border-blue-400"
                    onClick={() => {
                      sendQuickPrompt("Help me choose dryAPI models for chat, image generation, and embeddings.")
                    }}
                    type="button"
                  >
                    Model Selection
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-site-strong transition hover:border-blue-400"
                    onClick={() => {
                      sendQuickPrompt("Show me an OpenAI-compatible request example for dryAPI.")
                    }}
                    type="button"
                  >
                    Integration Help
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-site-strong transition hover:border-blue-400"
                    onClick={() => {
                      openQuoteDialog()
                    }}
                    type="button"
                  >
                    Contact Sales
                  </button>
                </div>
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div key={message.id}>
                <div
                  className={cn(
                    "flex items-start gap-2",
                    message.role === "assistant" ? "pr-4" : "justify-end pl-4"
                  )}
                >
                  {message.role === "assistant" ? (
                    <AssistantAvatar className="mt-0.5" />
                  ) : null}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      message.role === "assistant"
                        ? message.isError
                          ? "border border-red-200 bg-red-50 text-red-700"
                          : "border border-slate-200 bg-white text-site-strong shadow-sm"
                        : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                    {message.showQuoteButton ? (
                      <button
                        className="mt-3 inline-flex rounded-md border border-blue-300 bg-blue-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:brightness-110"
                        onClick={() => {
                          openQuoteDialog()
                        }}
                        type="button"
                      >
                        Get A Quote
                      </button>
                    ) : null}
                  </div>
                </div>
                {shouldRenderTimestamp(messages, index) ? (
                  <p
                    className={cn(
                      "mt-1 text-[10px] text-site-muted",
                      message.role === "assistant" ? "pl-11" : "pr-1 text-right"
                    )}
                  >
                    {formatMessageTimestamp(message.createdAt)}
                  </p>
                ) : null}
              </div>
            ))}

            {isSending ? (
              <div className="flex items-start gap-2 pr-4" role="status">
                <AssistantAvatar className="mt-0.5" />
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-700 shadow-sm">
                  <Loader2 className="size-3.5 animate-spin text-blue-600" />
                  Typing...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {showTurnstile && turnstileEnabled ? (
              <div className="mb-2">
                <TurnstileWidget
                  action="chat_frequent"
                  className="min-h-[65px]"
                  onError={() => {
                    setChatStatusMessage("Verification failed. Please retry the challenge.")
                  }}
                  onTokenChange={setTurnstileToken}
                  resetKey={turnstileResetKey}
                />
              </div>
            ) : null}
            {chatStatusMessage ? <p className="mb-2 text-xs text-red-700">{chatStatusMessage}</p> : null}
            {needsContactCapture ? (
              <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs text-slate-700">Leave your email or mobile number so our team can follow up after you leave the site.</p>
                <div className="grid gap-2">
                  <input
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-site-strong placeholder:text-site-muted"
                    onChange={(event) => setCaptureEmail(event.target.value)}
                    placeholder="Email"
                    type="email"
                    value={captureEmail}
                  />
                  <input
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-site-strong placeholder:text-site-muted"
                    onChange={(event) => setCapturePhone(event.target.value)}
                    placeholder="Mobile number"
                    value={capturePhone}
                  />
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmittingCapture}
                    onClick={() => {
                      void submitContactCapture()
                    }}
                    type="button"
                  >
                    {isSubmittingCapture ? "Sending..." : "Send Contact Details"}
                  </button>
                </div>
                {captureStatus ? <p className="mt-2 text-[11px] text-red-700">{captureStatus}</p> : null}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                className="min-h-[44px] flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-site-strong outline-none transition placeholder:text-site-muted focus:border-blue-500"
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask about pricing, model routing, API compatibility, or rate limits"
                rows={2}
                value={inputValue}
              />
              <button
                aria-label="Send message"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
