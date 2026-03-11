"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { contactSubmissionSchema } from "@/lib/contact-schema"

type ContactPageFormProps = {
  responseTime: string
}

type FormErrors = Partial<Record<"name" | "email" | "message", string>>

const enquiryTypes = ["Sales", "Rental", "Service", "Parts", "Other"] as const
const contactMethods = ["Call me", "Email me"] as const
const stateOptions = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const

export function ContactPageForm({ responseTime }: ContactPageFormProps) {
  const [formValues, setFormValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    state: "",
    enquiryType: "",
    preferredContactMethod: "",
    message: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const fullName = useMemo(
    () => [formValues.firstName.trim(), formValues.lastName.trim()].filter(Boolean).join(" "),
    [formValues.firstName, formValues.lastName]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusMessage("")

    const parsed = contactSubmissionSchema.safeParse({
      name: fullName,
      email: formValues.email,
      company: formValues.company,
      phone: formValues.phone,
      state: formValues.state,
      enquiryType: formValues.enquiryType,
      preferredContactMethod: formValues.preferredContactMethod,
      message: formValues.message,
    })

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

      setStatusMessage(body.message ?? "Thanks, your message has been sent.")
      setFormValues({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        state: "",
        enquiryType: "",
        preferredContactMethod: "",
        message: "",
      })
    } catch {
      setStatusMessage("We could not submit your request right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
        Complete the fields below and we will route your enquiry to the right specialist.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="firstName">
            First name
          </Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="firstName"
            name="firstName"
            onChange={(event) => setFormValues((previous) => ({ ...previous, firstName: event.target.value }))}
            placeholder="First name"
            value={formValues.firstName}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="lastName">
            Last name
          </Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="lastName"
            name="lastName"
            onChange={(event) => setFormValues((previous) => ({ ...previous, lastName: event.target.value }))}
            placeholder="Last name"
            value={formValues.lastName}
          />
        </div>
      </div>
      {errors.name ? <p className="text-xs text-[#d3582a]">{errors.name}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="email">
            Email
          </Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="email"
            name="email"
            onChange={(event) => setFormValues((previous) => ({ ...previous, email: event.target.value }))}
            placeholder="you@company.com"
            type="email"
            value={formValues.email}
          />
          {errors.email ? <p className="text-xs text-[#d3582a]">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="phone">
            Phone number (optional)
          </Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="phone"
            name="phone"
            onChange={(event) => setFormValues((previous) => ({ ...previous, phone: event.target.value }))}
            placeholder="0412 345 678"
            value={formValues.phone}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="company">
            Company name
          </Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="company"
            name="company"
            onChange={(event) => setFormValues((previous) => ({ ...previous, company: event.target.value }))}
            placeholder="Company"
            value={formValues.company}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="state">
            State
          </Label>
          <select
            className="h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
            id="state"
            name="state"
            onChange={(event) => setFormValues((previous) => ({ ...previous, state: event.target.value }))}
            value={formValues.state}
          >
            <option value="">Please select</option>
            {stateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Enquiry type</legend>
          <div className="space-y-1">
            {enquiryTypes.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  checked={formValues.enquiryType === option}
                  className="size-3.5 accent-[#ff8b2b]"
                  name="enquiryType"
                  onChange={() => setFormValues((previous) => ({ ...previous, enquiryType: option }))}
                  type="radio"
                  value={option}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            What is the best way to contact you?
          </legend>
          <div className="space-y-1">
            {contactMethods.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  checked={formValues.preferredContactMethod === option}
                  className="size-3.5 accent-[#ff8b2b]"
                  name="preferredContactMethod"
                  onChange={() => setFormValues((previous) => ({ ...previous, preferredContactMethod: option }))}
                  type="radio"
                  value={option}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="message">
          Message
        </Label>
        <Textarea
          className="min-h-28 rounded-sm border-slate-200 bg-white text-slate-900"
          id="message"
          name="message"
          onChange={(event) => setFormValues((previous) => ({ ...previous, message: event.target.value }))}
          placeholder="Tell us about your project requirements"
          rows={5}
          value={formValues.message}
        />
        {errors.message ? <p className="text-xs text-[#d3582a]">{errors.message}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{responseTime}</p>
        <Button
          className="rounded-sm bg-[#f47f2c] px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-white hover:bg-[#e56f1b]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Sending..." : "Submit"}
        </Button>
      </div>

      {statusMessage ? <p className="text-sm text-slate-700">{statusMessage}</p> : null}
    </form>
  )
}
