"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"

import { TurnstileWidget } from "@/components/site/turnstile-widget"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { buildContactFormData } from "@/lib/contact-form-submission"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { contactSubmissionSchema } from "@/lib/contact-schema"
import {
  formatFileSize,
  MAX_FORM_FILE_BYTES,
  MAX_FORM_FILE_COUNT,
  mergeFiles,
  validateFiles,
} from "@/lib/form-file-utils"
import type { SiteConfig } from "@/lib/site-content-schema"
import { cn } from "@/lib/utils"

type QuoteDialogProps = {
  site: SiteConfig
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

export function QuoteDialog({ site, triggerLabel, triggerClassName, triggerTinaField }: QuoteDialogProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [open, setOpen] = useState(false)
  const [formValues, setFormValues] = useState<QuoteFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<QuoteFormErrors>({})
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusTone, setStatusTone] = useState<"success" | "error" | "neutral">("neutral")
  const [statusMessage, setStatusMessage] = useState("")
  const [showTurnstile, setShowTurnstile] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const [quoteQuery, setQuoteQuery] = useQueryState(
    "quote",
    parseAsStringLiteral(["open"]).withOptions({
      history: "replace",
      scroll: false,
      shallow: true,
    })
  )
  const [quotePrefill] = useQueryStates(
    {
      enquiry: parseAsString,
      interest: parseAsString,
      suburb: parseAsString,
      delivery: parseAsString,
      notes: parseAsString,
      company: parseAsString,
      email: parseAsString,
      phone: parseAsString,
    },
    {
      history: "replace",
      scroll: false,
      shallow: true,
    }
  )

  const dialogTitle = resolveSiteUiText(site, "quoteDialog.title", "Get A Quote")
  const dialogDescription = resolveSiteUiText(
    site,
    "quoteDialog.description",
    "Share a few project details and our team will get back to you quickly."
  )
  const requiredHint = resolveSiteUiText(site, "quoteDialog.requiredHint", "Required fields are marked with an asterisk.")
  const fieldFirstName = resolveSiteUiText(site, "quoteDialog.field.firstName", "First name*")
  const fieldLastName = resolveSiteUiText(site, "quoteDialog.field.lastName", "Last name*")
  const fieldEmail = resolveSiteUiText(site, "quoteDialog.field.email", "Email*")
  const fieldCompany = resolveSiteUiText(site, "quoteDialog.field.company", "Company name")
  const fieldPhone = resolveSiteUiText(site, "quoteDialog.field.phone", "Phone number")
  const fieldPostcode = resolveSiteUiText(site, "quoteDialog.field.postcode", "Postcode/suburb of project*")
  const fieldEnquiry = resolveSiteUiText(
    site,
    "quoteDialog.field.enquiry",
    "Are you enquiring about rental or sales?*"
  )
  const fieldInterest = resolveSiteUiText(site, "quoteDialog.field.interest", "What are you interested in?*")
  const fieldDelivery = resolveSiteUiText(
    site,
    "quoteDialog.field.delivery",
    "Do you need delivery? (If yes please enter suburb/postcode, if no move to next)*"
  )
  const fieldNotes = resolveSiteUiText(site, "quoteDialog.field.notes", "Any other notes or comments?")
  const selectPlaceholder = resolveSiteUiText(site, "quoteDialog.select.placeholder", "Please Select")
  const responseTime = resolveSiteUiText(site, "quoteDialog.responseTime", "We usually respond within one business day.")
  const submitIdle = resolveSiteUiText(site, "quoteDialog.submitIdle", "Submit")
  const submitBusy = resolveSiteUiText(site, "quoteDialog.submitBusy", "Submitting...")
  const submitError = resolveSiteUiText(site, "quoteDialog.submitError", "We could not submit your request right now.")
  const submitSuccess = resolveSiteUiText(site, "quoteDialog.submitSuccess", "Thanks, your quote request has been sent.")

  const enquiryOptions = useMemo(
    () => [
      resolveSiteUiText(site, "quoteDialog.enquiryOption.rental", "Rental"),
      resolveSiteUiText(site, "quoteDialog.enquiryOption.sales", "Sales"),
    ],
    [site]
  )
  const interestOptions = useMemo(
    () => [
      resolveSiteUiText(site, "quoteDialog.interestOption.generators", "Generators"),
      resolveSiteUiText(site, "quoteDialog.interestOption.lighting", "Lighting"),
      resolveSiteUiText(site, "quoteDialog.interestOption.airTools", "Air Power Tools"),
      resolveSiteUiText(site, "quoteDialog.interestOption.welders", "Welders"),
      resolveSiteUiText(site, "quoteDialog.interestOption.solar", "Solar Generators"),
      resolveSiteUiText(site, "quoteDialog.interestOption.service", "Service Support"),
      resolveSiteUiText(site, "quoteDialog.interestOption.other", "Other"),
    ],
    [site]
  )
  const enquiryValueByParam = useMemo(
    () => ({
      rental: enquiryOptions[0]?.value,
      sales: enquiryOptions[1]?.value,
    }),
    [enquiryOptions]
  )
  const interestValueByParam = useMemo(
    () => ({
      generators: interestOptions[0]?.value,
      lighting: interestOptions[1]?.value,
      "air-tools": interestOptions[2]?.value,
      welders: interestOptions[3]?.value,
      "solar-generators": interestOptions[4]?.value,
      "service-support": interestOptions[5]?.value,
      other: interestOptions[6]?.value,
    }),
    [interestOptions]
  )

  const validationFirstName = resolveSiteUiText(site, "quoteDialog.validation.firstName", "First name is required.")
  const validationLastName = resolveSiteUiText(site, "quoteDialog.validation.lastName", "Last name is required.")
  const validationEmail = resolveSiteUiText(site, "quoteDialog.validation.email", "Email is required.")
  const validationPostcode = resolveSiteUiText(
    site,
    "quoteDialog.validation.postcode",
    "Postcode/suburb of project is required."
  )
  const validationEnquiry = resolveSiteUiText(site, "quoteDialog.validation.enquiry", "Please choose rental or sales.")
  const validationInterest = resolveSiteUiText(
    site,
    "quoteDialog.validation.interest",
    "Please select what you are interested in."
  )
  const validationDelivery = resolveSiteUiText(site, "quoteDialog.validation.delivery", "Please add your delivery details.")

  useEffect(() => {
    setIsHydrated(true)

    const handleOpenRequest = () => {
      setOpen(true)
    }

    window.addEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest)

    return () => {
      window.removeEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest)
    }
  }, [])

  useEffect(() => {
    if (quoteQuery === "open") {
      setOpen(true)
    }
  }, [quoteQuery])

  useEffect(() => {
    setFormValues((previous) => {
      const next = { ...previous }
      let changed = false

      const enquiryParam = quotePrefill.enquiry?.trim().toLowerCase()
      if (!next.enquiryStream && enquiryParam && enquiryParam in enquiryValueByParam) {
        const mapped = enquiryValueByParam[enquiryParam as keyof typeof enquiryValueByParam]
        if (mapped) {
          next.enquiryStream = mapped
          changed = true
        }
      }

      const interestParam = quotePrefill.interest?.trim().toLowerCase()
      if (!next.interest && interestParam && interestParam in interestValueByParam) {
        const mapped = interestValueByParam[interestParam as keyof typeof interestValueByParam]
        if (mapped) {
          next.interest = mapped
          changed = true
        }
      }

      if (!next.projectSuburbPostcode && quotePrefill.suburb?.trim()) {
        next.projectSuburbPostcode = quotePrefill.suburb.trim()
        changed = true
      }

      if (!next.deliveryDetails && quotePrefill.delivery?.trim()) {
        next.deliveryDetails = quotePrefill.delivery.trim()
        changed = true
      }

      if (!next.notes && quotePrefill.notes?.trim()) {
        next.notes = quotePrefill.notes.trim()
        changed = true
      }

      if (!next.companyName && quotePrefill.company?.trim()) {
        next.companyName = quotePrefill.company.trim()
        changed = true
      }

      if (!next.email && quotePrefill.email?.trim()) {
        next.email = quotePrefill.email.trim()
        changed = true
      }

      if (!next.phoneNumber && quotePrefill.phone?.trim()) {
        next.phoneNumber = quotePrefill.phone.trim()
        changed = true
      }

      return changed ? next : previous
    })
  }, [enquiryValueByParam, interestValueByParam, quotePrefill])

  const fullName = useMemo(
    () => [formValues.firstName.trim(), formValues.lastName.trim()].filter(Boolean).join(" "),
    [formValues.firstName, formValues.lastName]
  )

  function handleFieldChange<K extends keyof QuoteFormValues>(field: K, value: QuoteFormValues[K]) {
    setFormValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen && quoteQuery) {
      void setQuoteQuery(null)
    }
  }

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles)
    setFileError(validateFiles(nextFiles) || "")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusTone("neutral")
    setStatusMessage("")

    if (showTurnstile && turnstileEnabled && !turnstileToken) {
      setStatusTone("error")
      setStatusMessage("Please complete the verification challenge before submitting again.")
      return
    }

    const nextFileError = validateFiles(files)
    if (nextFileError) {
      setFileError(nextFileError)
      setStatusTone("error")
      return
    }

    const fieldErrors: QuoteFormErrors = {}

    if (!formValues.firstName.trim()) {
      fieldErrors.firstName = validationFirstName.value
    }

    if (!formValues.lastName.trim()) {
      fieldErrors.lastName = validationLastName.value
    }

    if (!formValues.email.trim()) {
      fieldErrors.email = validationEmail.value
    }

    if (!formValues.projectSuburbPostcode.trim()) {
      fieldErrors.projectSuburbPostcode = validationPostcode.value
    }

    if (!formValues.enquiryStream.trim()) {
      fieldErrors.enquiryStream = validationEnquiry.value
    }

    if (!formValues.interest.trim()) {
      fieldErrors.interest = validationInterest.value
    }

    if (!formValues.deliveryDetails.trim()) {
      fieldErrors.deliveryDetails = validationDelivery.value
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      setStatusTone("error")
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
      setStatusTone("error")
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const formData = buildContactFormData(parsed.data as Record<string, string>, files, turnstileToken)

      const response = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      })

      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        error?: string
        requiresTurnstile?: boolean
      }

      if (response.status === 429 && body.requiresTurnstile) {
        setShowTurnstile(true)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
        setStatusTone("error")
        setStatusMessage(body.error || "Please complete verification before submitting again.")
        return
      }

      if (!response.ok || !body.ok) {
        setStatusTone("error")
        setStatusMessage(body.error || submitError.value)
        return
      }

      setStatusTone("success")
      setStatusMessage(body.message ?? submitSuccess.value)
      setFormValues(INITIAL_VALUES)
      updateFiles([])
      if (showTurnstile) {
        setShowTurnstile(false)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
      }
      setTimeout(() => {
        handleOpenChange(false)
        setStatusTone("neutral")
        setStatusMessage("")
      }, 1200)
    } catch {
      setStatusTone("error")
      setStatusMessage(submitError.value)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isHydrated) {
    return (
      <button className={cn(triggerClassName)} data-tina-field={triggerTinaField} type="button">
        {triggerLabel}
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className={cn(triggerClassName)} data-tina-field={triggerTinaField} type="button">
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="z-[60] max-h-[88vh] overflow-y-auto border-slate-200 bg-white p-6 text-slate-900 sm:max-w-[46rem]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-display text-2xl uppercase tracking-[0.06em] text-[#101a28]" data-tina-field={dialogTitle.field}>{dialogTitle.value}</DialogTitle>
          <DialogDescription className="text-sm text-slate-600" data-tina-field={dialogDescription.field}>{dialogDescription.value}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500" data-tina-field={requiredHint.field}>{requiredHint.value}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-first-name" data-tina-field={fieldFirstName.field}>{fieldFirstName.value}</Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-first-name"
                onChange={(event) => handleFieldChange("firstName", event.target.value)}
                value={formValues.firstName}
              />
              {errors.firstName ? <p className="text-xs text-[#d3582a]">{errors.firstName}</p> : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-last-name" data-tina-field={fieldLastName.field}>{fieldLastName.value}</Label>
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
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-email" data-tina-field={fieldEmail.field}>{fieldEmail.value}</Label>
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
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-company" data-tina-field={fieldCompany.field}>{fieldCompany.value}</Label>
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
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-phone" data-tina-field={fieldPhone.field}>{fieldPhone.value}</Label>
              <Input
                className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
                id="quote-phone"
                onChange={(event) => handleFieldChange("phoneNumber", event.target.value)}
                value={formValues.phoneNumber}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-postcode" data-tina-field={fieldPostcode.field}>{fieldPostcode.value}</Label>
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
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-enquiry-stream" data-tina-field={fieldEnquiry.field}>{fieldEnquiry.value}</Label>
            <select
              className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
              id="quote-enquiry-stream"
              onChange={(event) => handleFieldChange("enquiryStream", event.target.value)}
              value={formValues.enquiryStream}
            >
              <option value="">{selectPlaceholder.value}</option>
              {enquiryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            {errors.enquiryStream ? <p className="text-xs text-[#d3582a]">{errors.enquiryStream}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-interest" data-tina-field={fieldInterest.field}>{fieldInterest.value}</Label>
            <select
              className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
              id="quote-interest"
              onChange={(event) => handleFieldChange("interest", event.target.value)}
              value={formValues.interest}
            >
              <option value="">{selectPlaceholder.value}</option>
              {interestOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            {errors.interest ? <p className="text-xs text-[#d3582a]">{errors.interest}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-delivery" data-tina-field={fieldDelivery.field}>{fieldDelivery.value}</Label>
            <Input
              className="h-10 rounded-sm border-slate-300 bg-white text-slate-900"
              id="quote-delivery"
              onChange={(event) => handleFieldChange("deliveryDetails", event.target.value)}
              value={formValues.deliveryDetails}
            />
            {errors.deliveryDetails ? <p className="text-xs text-[#d3582a]">{errors.deliveryDetails}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600" htmlFor="quote-notes" data-tina-field={fieldNotes.field}>{fieldNotes.value}</Label>
            <Textarea
              className="min-h-20 rounded-sm border-slate-300 bg-white text-slate-900"
              id="quote-notes"
              onChange={(event) => handleFieldChange("notes", event.target.value)}
              rows={3}
              value={formValues.notes}
            />
            {errors.notes ? <p className="text-xs text-[#d3582a]">{errors.notes}</p> : null}
          </div>

          <FileDropzone
            disabled={isSubmitting}
            error={fileError || undefined}
            files={files}
            hint={`Up to ${MAX_FORM_FILE_COUNT} files, max ${formatFileSize(MAX_FORM_FILE_BYTES)} each.`}
            id="quote-form-files"
            label="Attachments"
            onFileRemove={(file) => {
              updateFiles(files.filter((item) => item !== file))
            }}
            onFilesAdd={(incoming) => {
              updateFiles(mergeFiles(files, incoming, MAX_FORM_FILE_COUNT))
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500" data-tina-field={responseTime.field}>{responseTime.value}</p>
            <Button
              className="rounded-sm bg-[#f47f2c] px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-white hover:bg-[#e56f1b]"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? submitBusy.value : submitIdle.value}
            </Button>
          </div>

          {showTurnstile && turnstileEnabled ? (
            <div className="space-y-2 rounded-sm border border-slate-300 p-3">
              <TurnstileWidget
                action="quote_submit"
                className="min-h-[65px]"
                onError={() => {
                  setStatusTone("error")
                  setStatusMessage("Verification failed. Please retry the challenge.")
                }}
                onTokenChange={setTurnstileToken}
                resetKey={turnstileResetKey}
              />
              <p className="text-xs text-slate-500">Verification is required after frequent submissions.</p>
            </div>
          ) : null}

          {statusMessage ? (
            <p
              className={cn(
                "text-sm",
                statusTone === "error"
                  ? "text-[#d3582a]"
                  : statusTone === "success"
                    ? "text-emerald-700"
                    : "text-slate-700"
              )}
            >
              {statusMessage}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
