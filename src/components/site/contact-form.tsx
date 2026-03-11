"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { contactSubmissionSchema } from "@/lib/contact-schema"

type ContactFormProps = {
  heading: string
  description: string
  responseTime: string
}

type FormErrors = Partial<Record<"name" | "email" | "message", string>>

export function ContactForm({ heading, description, responseTime }: ContactFormProps) {
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusMessage("")

    const parsed = contactSubmissionSchema.safeParse(formValues)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        message: fieldErrors.message?.[0],
      })
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      })

      const body = (await response.json()) as { ok?: boolean; message?: string }

      if (!response.ok || !body.ok) {
        setStatusMessage("We could not submit your request right now.")
        return
      }

      setStatusMessage(body.message ?? "Thanks — your message has been sent.")
      setFormValues({
        name: "",
        email: "",
        company: "",
        message: "",
      })
    } catch {
      setStatusMessage("We could not submit your request right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#ff8b2b]">Project Enquiry</p>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.08em] text-white">{heading}</h2>
        <p className="mt-2 text-slate-300">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-slate-300" htmlFor="name">Name</Label>
            <Input
              className="h-10 border-white/20 bg-[#0e1826] text-slate-100"
              id="name"
              name="name"
              onChange={(event) =>
                setFormValues((previous) => ({ ...previous, name: event.target.value }))
              }
              placeholder="Your name"
              value={formValues.name}
            />
            {errors.name ? <p className="text-sm text-[#ff8b2b]">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300" htmlFor="email">Email</Label>
            <Input
              className="h-10 border-white/20 bg-[#0e1826] text-slate-100"
              id="email"
              name="email"
              onChange={(event) =>
                setFormValues((previous) => ({ ...previous, email: event.target.value }))
              }
              placeholder="you@company.com"
              type="email"
              value={formValues.email}
            />
            {errors.email ? <p className="text-sm text-[#ff8b2b]">{errors.email}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300" htmlFor="company">Company</Label>
          <Input
            className="h-10 border-white/20 bg-[#0e1826] text-slate-100"
            id="company"
            name="company"
            onChange={(event) =>
              setFormValues((previous) => ({ ...previous, company: event.target.value }))
            }
            placeholder="Optional"
            value={formValues.company}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300" htmlFor="message">Project details</Label>
          <Textarea
            className="border-white/20 bg-[#0e1826] text-slate-100"
            id="message"
            name="message"
            onChange={(event) =>
              setFormValues((previous) => ({ ...previous, message: event.target.value }))
            }
            placeholder="Tell us about your timeline, scope, and site requirements"
            rows={6}
            value={formValues.message}
          />
          {errors.message ? <p className="text-sm text-[#ff8b2b]">{errors.message}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm uppercase tracking-[0.14em] text-slate-400">{responseTime}</p>
          <Button
            className="rounded-sm bg-[#ff8b2b] px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#ff7f19]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Sending..." : "Send Inquiry"}
          </Button>
        </div>
        {statusMessage ? <p className="text-sm text-slate-200">{statusMessage}</p> : null}
      </form>
    </section>
  )
}
