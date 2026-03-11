"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { contactSubmissionSchema } from "@/lib/contact-schema"
import { cn } from "@/lib/utils"

type QuoteDialogProps = {
  triggerLabel: string
  triggerClassName?: string
  triggerTinaField?: string
}

type QuoteFormValues = {
  firstName: string
  lastName: string
  email: string
  companyName: string
  phoneNumber: string
  projectSuburbPostcode: string
  enquiryStream: string
  interest: string
  deliveryDetails: string
  notes: string
}

type QuoteFormErrors = Partial<Record<keyof QuoteFormValues, string>>

const OPEN_QUOTE_DIALOG_EVENT = "genfix:open-quote-dialog"

export function openQuoteDialog() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(OPEN_QUOTE_DIALOG_EVENT))
}

const enquiryOptions = ["Rental", "Sales"] as const

const interestOptions = [
  "Generators",
  "Lighting",
  "Air Power Tools",
  "Welders",
  "Solar Generators",
  "Service Support",
  "Other",
] as const

const INITIAL_VALUES: QuoteFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  companyName: "",
  phoneNumber: "",
  projectSuburbPostcode: "",
  enquiryStream: "",
  interest: "",
  deliveryDetails: "",
  notes: "",
}

function buildMessage(values: QuoteFormValues) {
  return [
    "Quote request details",
    `Project suburb/postcode: ${values.projectSuburbPostcode}`,
    `Interested in: ${values.interest}`,
    `Delivery details: ${values.deliveryDetails}`,
    `Additional notes: ${values.notes || "Not provided"}`,
  ].join("\n")
}

function validate(values: QuoteFormValues) {
  const errors: QuoteFormErrors = {}

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required."
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required."
  }

  if (!values.email.trim()) {
    errors.email = "Email is required."
  }

  if (!values.projectSuburbPostcode.trim()) {
    errors.projectSuburbPostcode = "Postcode/suburb of project is required."
  }

  if (!values.enquiryStream.trim()) {
    errors.enquiryStream = "Please choose rental or sales."
  }

  if (!values.interest.trim()) {
    errors.interest = "Please select what you are interested in."
  }

  if (!values.deliveryDetails.trim()) {
    errors.deliveryDetails = "Please add your delivery details."
  }

  return errors
}

export function QuoteDialog({ triggerLabel, triggerClassName, triggerTinaField }: QuoteDialogProps) {
  const [open, setOpen] = useState(false)
  const [formValues, setFormValues] = useState<QuoteFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<QuoteFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  useEffect(() => {
    const handleOpenRequest = () => {
      setOpen(true)
    }

    window.addEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest)

    return () => {
      window.removeEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest)
    }
  }, [])

  const fullName = useMemo(
    () => [formValues.firstName.trim(), formValues.lastName.trim()].filter(Boolean).join(" "),
    [formValues.firstName, formValues.lastName]
  )

  function handleFieldChange<K extends keyof QuoteFormValues>(field: K, value: QuoteFormValues[K]) {
    setFormValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusMessage("")

    const fieldErrors = validate(formValues)

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    const payload = {
      submissionType: "quote" as const,
      name: fullName,
      email: formValues.email,
      company: formValues.companyName,
      phone: formValues.phoneNumber,
      enquiryType: formValues.enquiryStream,
      message: buildMessage(formValues),
    }

    const parsed = contactSubmissionSchema.safeParse(payload)

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors
      setErrors({
        firstName: flattened.name?.[0],
        email: flattened.email?.[0],
        notes: flattened.message?.[0],
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

      setStatusMessage(body.message ?? "Thanks, your quote request has been sent.")
      setFormValues(INITIAL_VALUES)
      setTimeout(() => {
        setOpen(false)
        setStatusMessage("")
      }, 1200)
    } catch {
      setStatusMessage("We could not submit your request right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn(triggerClassName)} data-tina-field={triggerTinaField} type="button">
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-200 bg-white p-6 text-slate-900 sm:max-w-[46rem]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-display text-2xl uppercase tracking-[0.06em] text-[#101a28]">
            Get A Quote
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Share a few project details and our team will get back to you quickly.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Required fields are marked with an asterisk.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-first-name">
                First name*
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-first-name"
                onChange={(event) => handleFieldChange("firstName", event.target.value)}
                value={formValues.firstName}
              />
              {errors.firstName ? <p className="text-xs text-[#d3582a]">{errors.firstName}</p> : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-last-name">
                Last name*
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-last-name"
                onChange={(event) => handleFieldChange("lastName", event.target.value)}
                value={formValues.lastName}
              />
              {errors.lastName ? <p className="text-xs text-[#d3582a]">{errors.lastName}</p> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-email">
                Email*
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-email"
                onChange={(event) => handleFieldChange("email", event.target.value)}
                type="email"
                value={formValues.email}
              />
              {errors.email ? <p className="text-xs text-[#d3582a]">{errors.email}</p> : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-company">
                Company name
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-company"
                onChange={(event) => handleFieldChange("companyName", event.target.value)}
                value={formValues.companyName}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-phone">
                Phone number
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-phone"
                onChange={(event) => handleFieldChange("phoneNumber", event.target.value)}
                value={formValues.phoneNumber}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-postcode">
                Postcode/suburb of project*
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-postcode"
                onChange={(event) => handleFieldChange("projectSuburbPostcode", event.target.value)}
                value={formValues.projectSuburbPostcode}
              />
              {errors.projectSuburbPostcode ? (
                <p className="text-xs text-[#d3582a]">{errors.projectSuburbPostcode}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-enquiry-stream">
              Are you enquiring about rental or sales?*
            </Label>
            <select
              className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
              id="quote-enquiry-stream"
              onChange={(event) => handleFieldChange("enquiryStream", event.target.value)}
              value={formValues.enquiryStream}
            >
              <option value="">Please Select</option>
              {enquiryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.enquiryStream ? <p className="text-xs text-[#d3582a]">{errors.enquiryStream}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-interest">
              What are you interested in?*
            </Label>
            <select
              className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
              id="quote-interest"
              onChange={(event) => handleFieldChange("interest", event.target.value)}
              value={formValues.interest}
            >
              <option value="">Please Select</option>
              {interestOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.interest ? <p className="text-xs text-[#d3582a]">{errors.interest}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-delivery">
              Do you need delivery? (If yes please enter suburb/postcode, if no move to next)*
            </Label>
            <Input
              className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
              id="quote-delivery"
              onChange={(event) => handleFieldChange("deliveryDetails", event.target.value)}
              value={formValues.deliveryDetails}
            />
            {errors.deliveryDetails ? <p className="text-xs text-[#d3582a]">{errors.deliveryDetails}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-notes">
              Any other notes or comments?
            </Label>
            <Textarea
              className="min-h-20 rounded-sm border-slate-300 bg-white text-slate-900"
              id="quote-notes"
              onChange={(event) => handleFieldChange("notes", event.target.value)}
              rows={3}
              value={formValues.notes}
            />
            {errors.notes ? <p className="text-xs text-[#d3582a]">{errors.notes}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">We usually respond within one business day.</p>
            <Button
              className="rounded-sm bg-[#f47f2c] px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-white hover:bg-[#e56f1b]"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>

          {statusMessage ? <p className="text-sm text-slate-700">{statusMessage}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
