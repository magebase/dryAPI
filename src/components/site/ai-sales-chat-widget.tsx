"use client"

import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { submitChatContactCaptureAction } from "@/app/actions/submit-chat-contact-capture-action"
import { openQuoteDialog } from "@/components/site/quote-dialog"
import { TurnstileWidget } from "@/components/site/turnstile-widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { isCalcomBookingEnabledClient, isStripeDepositsEnabledClient } from "@/lib/feature-flags"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  createdAt: number
  role: "assistant" | "user"
  content: string
  showQuoteButton?: boolean
  showBookServiceButton?: boolean
  bookServiceHref?: string
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

type BookingFlowState = {
  step: "suburb" | "time" | "complete"
  suburb?: string
}

const SESSION_WELCOME_KEY = "genfix-chat-welcome-v1"
const VISITOR_KEY = "genfix-chat-visitor-v1"
const WELCOME_DELAY_MS = 30_000
const SERVICE_HOURS_LABEL = "Service hours: Mon-Sat 7AM-7PM"
const AVERAGE_REPLY_TIME_LABEL = "Average reply: 3 minutes"
const DEFAULT_CALCOM_BOOKING_URL = "https://cal.genfix.com.au/"

function resolveBookingCtaHref({ bookingUrl, depositsEnabled }: { bookingUrl: string; depositsEnabled: boolean }): string {
  if (!depositsEnabled) {
    return bookingUrl
  }

  return `/book/deposit?calcomBookingUrl=${encodeURIComponent(bookingUrl)}`
}

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

function getBrisbaneSupportPresence(now = new Date()): { isOnline: boolean; label: string } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now)

  const weekday = parts.find((part) => part.type === "weekday")?.value || "Mon"
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value || "0", 10)
  const isBusinessDay = weekday !== "Sun"
  const isOnline = isBusinessDay && hour >= 7 && hour < 19

  return {
    isOnline,
    label: isOnline
      ? "Technician online"
      : "Offline right now. Leave a message and we will reply in the morning.",
  }
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <Avatar
      className={cn(
        "size-9 shrink-0 rounded-full border border-[#ffd1ad]/55 bg-[#152438] p-[2px] shadow-[0_10px_24px_rgba(0,0,0,0.38)]",
        className
      )}
    >
      <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_22%,#ffe2cf_0%,#ffad6d_38%,#f07a28_68%,#b64a0f_100%)] text-[#162334]">
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
  const [bookingFlow, setBookingFlow] = useState<BookingFlowState | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const bookingEnabled = isCalcomBookingEnabledClient()
  const depositsEnabled = isStripeDepositsEnabledClient()
  const bookingUrl = process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL?.trim() || DEFAULT_CALCOM_BOOKING_URL
  const bookingCtaHref = useMemo(
    () => resolveBookingCtaHref({ bookingUrl, depositsEnabled }),
    [bookingUrl, depositsEnabled]
  )
  const supportPresence = getBrisbaneSupportPresence()

  const greeting = useMemo(
    () =>
      createChatMessage({
        role: "assistant",
        content: "Hi! Need generator servicing?",
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

  function startBookingFlow() {
    if (!bookingEnabled) {
      openQuoteDialog()
      return
    }

    setBookingFlow({ step: "suburb" })
    setIsOpen(true)
    ensureGreeting()
    setChatStatusMessage("")

    setMessages((current) => {
      const base = current.length > 0 ? current : [greeting]
      const alreadyPrompted = base.some(
        (message) => message.role === "assistant" && message.content.includes("What suburb are you in")
      )

      if (alreadyPrompted) {
        return base
      }

      return [
        ...base,
        createChatMessage({
          role: "assistant",
          content: "Great choice. What suburb are you in?",
        }),
      ]
    })

    window.setTimeout(() => {
      composerRef.current?.focus()
    }, 0)
  }

  function focusComposer() {
    setIsOpen(true)
    ensureGreeting()
    setBookingFlow(null)
    window.setTimeout(() => {
      composerRef.current?.focus()
    }, 0)
  }

  function sendQuickPrompt(prompt: string) {
    ensureGreeting()
    setBookingFlow(null)
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

    if (bookingFlow?.step === "suburb") {
      const userMessage = createChatMessage({
        role: "user",
        content: trimmed,
      })

      const assistantMessage = createChatMessage({
        role: "assistant",
        content: `Thanks. What day or time works best in ${trimmed}?`,
      })

      setMessages((current) => [...current, userMessage, assistantMessage])
      setBookingFlow({ step: "time", suburb: trimmed })
      return
    }

    if (bookingFlow?.step === "time") {
      const userMessage = createChatMessage({
        role: "user",
        content: trimmed,
      })

      const assistantMessage = createChatMessage({
        role: "assistant",
        content: `Perfect. I noted ${bookingFlow.suburb || "your area"} and your preferred timing (${trimmed}). Book a service slot instantly below.`,
        showBookServiceButton: bookingEnabled,
        bookServiceHref: bookingCtaHref,
      })

      setMessages((current) => [...current, userMessage, assistantMessage])
      setBookingFlow({ ...bookingFlow, step: "complete" })
      return
    }

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

    setMessages((current) => [...current, userMessage])
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

      let body: ChatApiResponse
      try {
        body = (await response.json()) as ChatApiResponse
      } catch {
        body = {
          ok: false,
          error: "The assistant returned an unreadable response.",
        }
      }
      const fallbackText = "I can help with generator hire, sales, and service options. Tell me your timeline and site details."

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

    if (!email && !phone) {
      setCaptureStatus("Add an email or mobile number so our team can follow up.")
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCaptureStatus("Please enter a valid email address.")
      return
    }

    if (phone) {
      const digitsOnly = phone.replace(/\D/g, "")
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        setCaptureStatus("Please enter a valid mobile number.")
        return
      }
    }

    setIsSubmittingCapture(true)
    setCaptureStatus("")

    try {
      const result = await submitChatContactCaptureAction({
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

      if (result?.validationErrors) {
        setCaptureStatus("Please check the contact details and try again.")
        return
      }

      if (result?.serverError || !result?.data?.ok) {
        setCaptureStatus(result?.serverError || result?.data?.error || "Unable to send contact details right now.")
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
      if (body.escalated) {
        setEscalationSent(true)
      }
    } catch {
      setCaptureStatus("Unable to send contact details right now.")
    } finally {
      setIsSubmittingCapture(false)
    }
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close GenFix assistant" : "Open GenFix assistant"}
        className="fixed bottom-4 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#ffb67f]/40 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] text-white shadow-[0_14px_28px_rgba(255,116,38,0.38)] transition hover:brightness-110"
        onClick={() => {
          setIsOpen((current) => !current)
          ensureGreeting()
        }}
        type="button"
      >
        {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {isOpen ? (
        <section className="fixed bottom-20 right-2 z-40 flex h-[min(36rem,72vh)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0d1828]/96 shadow-[0_16px_45px_rgba(0,0,0,0.48)] backdrop-blur md:bottom-24 md:right-4">
          <header className="border-b border-white/10 bg-[#101a28] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#ff8b2b]">GenFix AI Assistant</p>
            <p className="mt-1 text-sm text-slate-200">Fast answers for generator hire, sales, and support.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                  supportPresence.isOnline
                    ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200"
                    : "border-slate-300/20 bg-slate-500/10 text-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    supportPresence.isOnline ? "bg-emerald-300" : "bg-slate-300"
                  )}
                />
                {supportPresence.label}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200">
                {AVERAGE_REPLY_TIME_LABEL}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">{SERVICE_HOURS_LABEL}</p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length <= 1 ? (
              <div className="rounded-lg border border-white/10 bg-[#101a28] p-2.5">
                <p className="text-xs text-slate-200">Pick the fastest option:</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {bookingEnabled ? (
                    <button
                      className="inline-flex items-center justify-center rounded-md border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                      onClick={startBookingFlow}
                      type="button"
                    >
                      Book Service
                    </button>
                  ) : null}
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-white/20 bg-[#132238] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:border-[#ff8b2b]/50"
                    onClick={() => {
                      openQuoteDialog()
                    }}
                    type="button"
                  >
                    Get Quote
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-white/20 bg-[#132238] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:border-[#ff8b2b]/50"
                    onClick={() => {
                      sendQuickPrompt("I need emergency generator repair support right now.")
                    }}
                    type="button"
                  >
                    Emergency Repair
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border border-white/20 bg-[#132238] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:border-[#ff8b2b]/50"
                    onClick={focusComposer}
                    type="button"
                  >
                    Ask A Question
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
                          ? "border border-[#d3582a]/55 bg-[#2a1b1b] text-[#ffd7c8]"
                          : "border border-[#ff8b2b]/35 bg-[#132238] text-slate-100"
                        : "bg-[#ff8b2b] text-white"
                    }`}
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
                    {message.showBookServiceButton && bookingEnabled ? (
                      <a
                        className="mt-3 inline-flex rounded-sm border border-[#8ec5ff]/40 bg-[#1a3554] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d6ebff] transition hover:border-[#b9dcff]/70"
                        href={message.bookServiceHref || bookingCtaHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        See Available Times
                      </a>
                    ) : null}
                  </div>
                </div>
                {shouldRenderTimestamp(messages, index) ? (
                  <p
                    className={cn(
                      "mt-1 text-[10px] text-slate-400",
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
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#ff8b2b]/35 bg-[#132238] px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-200">
                  <Loader2 className="size-3.5 animate-spin text-[#ff8b2b]" />
                  Typing...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-[#101a28] p-3">
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
            {chatStatusMessage ? <p className="mb-2 text-xs text-[#ffd7c8]">{chatStatusMessage}</p> : null}
            {needsContactCapture ? (
              <div className="mb-2 rounded-md border border-[#ff8b2b]/35 bg-[#132238] p-2">
                <p className="mb-2 text-xs text-slate-200">Leave your email or mobile so our team can reply after you leave the site.</p>
                <div className="grid gap-2">
                  <input
                    className="h-9 rounded-md border border-white/20 bg-[#0d1828] px-2 text-xs text-slate-100 placeholder:text-slate-400"
                    onChange={(event) => setCaptureEmail(event.target.value)}
                    placeholder="Email"
                    type="email"
                    value={captureEmail}
                  />
                  <input
                    className="h-9 rounded-md border border-white/20 bg-[#0d1828] px-2 text-xs text-slate-100 placeholder:text-slate-400"
                    onChange={(event) => setCapturePhone(event.target.value)}
                    placeholder="Mobile number"
                    value={capturePhone}
                  />
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md bg-[#ff8b2b] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmittingCapture}
                    onClick={() => {
                      void submitContactCapture()
                    }}
                    type="button"
                  >
                    {isSubmittingCapture ? "Sending..." : "Send Contact Details"}
                  </button>
                </div>
                {captureStatus ? <p className="mt-2 text-[11px] text-[#ffd7c8]">{captureStatus}</p> : null}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                className="min-h-[44px] flex-1 resize-none rounded-md border border-white/20 bg-[#0d1828] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#ff8b2b]"
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder={
                  bookingFlow?.step === "suburb"
                    ? "Enter your suburb"
                    : bookingFlow?.step === "time"
                      ? "Enter your preferred day/time"
                      : "Ask about pricing, runtime, logistics, or service support"
                }
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
