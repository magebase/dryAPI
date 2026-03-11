"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsString, useQueryStates } from "nuqs"

import { FileDropzone } from "@/components/ui/file-dropzone"
import { TurnstileWidget } from "@/components/site/turnstile-widget"
import { Button } from "@/components/ui/button"
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

type ContactPageFormProps = {
  responseTime: string
  site: SiteConfig
}

type FormErrors = Partial<Record<"name" | "email" | "message", string>>

const defaultEnquiryTypes = ["Sales", "Rental", "Service", "Parts", "Other"] as const
const defaultContactMethods = ["Call me", "Email me"] as const
const stateOptions = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const

export function ContactPageForm({ responseTime, site }: ContactPageFormProps) {
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
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusTone, setStatusTone] = useState<"success" | "error" | "neutral">("neutral")
  const [statusMessage, setStatusMessage] = useState("")
  const [showTurnstile, setShowTurnstile] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const [contactPrefill] = useQueryStates(
    {
      firstName: parseAsString,
      lastName: parseAsString,
      name: parseAsString,
      email: parseAsString,
      phone: parseAsString,
      company: parseAsString,
      state: parseAsString,
      enquiry: parseAsString,
      contact: parseAsString,
      message: parseAsString,
    },
    {
      history: "replace",
      scroll: false,
      shallow: true,
    }
  )

  const introText = resolveSiteUiText(
    site,
    "contactPageForm.introText",
    "Complete the fields below and we will route your enquiry to the right specialist."
  )
  const firstNameLabel = resolveSiteUiText(site, "contactPageForm.firstNameLabel", "First name")
  const firstNamePlaceholder = resolveSiteUiText(site, "contactPageForm.firstNamePlaceholder", "First name")
  const lastNameLabel = resolveSiteUiText(site, "contactPageForm.lastNameLabel", "Last name")
  const lastNamePlaceholder = resolveSiteUiText(site, "contactPageForm.lastNamePlaceholder", "Last name")
  const emailLabel = resolveSiteUiText(site, "contactPageForm.emailLabel", "Email")
  const emailPlaceholder = resolveSiteUiText(site, "contactPageForm.emailPlaceholder", "you@company.com")
  const phoneLabel = resolveSiteUiText(site, "contactPageForm.phoneLabel", "Phone number (optional)")
  const phonePlaceholder = resolveSiteUiText(site, "contactPageForm.phonePlaceholder", "0412 345 678")
  const companyLabel = resolveSiteUiText(site, "contactPageForm.companyLabel", "Company name")
  const companyPlaceholder = resolveSiteUiText(site, "contactPageForm.companyPlaceholder", "Company")
  const stateLabel = resolveSiteUiText(site, "contactPageForm.stateLabel", "State")
  const statePlaceholder = resolveSiteUiText(site, "contactPageForm.statePlaceholder", "Please select")
  const enquiryTypeLabel = resolveSiteUiText(site, "contactPageForm.enquiryTypeLabel", "Enquiry type")
  const bestContactLabel = resolveSiteUiText(
    site,
    "contactPageForm.bestContactLabel",
    "What is the best way to contact you?"
  )
  const messageLabel = resolveSiteUiText(site, "contactPageForm.messageLabel", "Message")
  const messagePlaceholder = resolveSiteUiText(
    site,
    "contactPageForm.messagePlaceholder",
    "Tell us about your project requirements"
  )
  const submitIdleLabel = resolveSiteUiText(site, "contactPageForm.submitIdleLabel", "Submit")
  const submitBusyLabel = resolveSiteUiText(site, "contactPageForm.submitBusyLabel", "Sending...")
  const submitErrorMessage = resolveSiteUiText(
    site,
    "contactPageForm.submitErrorMessage",
    "We could not submit your request right now."
  )
  const enquiryTypes = defaultEnquiryTypes.map((option) => ({
    option,
    ...resolveSiteUiText(site, `contactPageForm.enquiryType.${option.toLowerCase()}`, option),
  }))
  const contactMethods = defaultContactMethods.map((option) => ({
    option,
    ...resolveSiteUiText(site, `contactPageForm.contactMethod.${option.toLowerCase().replaceAll(" ", "-")}`, option),
  }))
  const enquiryValueByKey = useMemo(() => {
    const map = new Map<string, string>()

    for (const item of enquiryTypes) {
      map.set(item.option.toLowerCase(), item.value)
      map.set(item.value.toLowerCase(), item.value)
    }

    return map
  }, [enquiryTypes])
  const contactMethodValueByKey = useMemo(() => {
    const map = new Map<string, string>()

    for (const item of contactMethods) {
      map.set(item.option.toLowerCase().replaceAll(" ", ""), item.value)
      map.set(item.value.toLowerCase().replaceAll(" ", ""), item.value)
    }

    map.set("call", contactMethods[0]?.value ?? "Call me")
    map.set("email", contactMethods[1]?.value ?? "Email me")

    return map
  }, [contactMethods])

  const fullName = useMemo(
    () => [formValues.firstName.trim(), formValues.lastName.trim()].filter(Boolean).join(" "),
    [formValues.firstName, formValues.lastName]
  )

  useEffect(() => {
    setFormValues((previous) => {
      const next = { ...previous }
      let changed = false

      if (!next.firstName && contactPrefill.firstName?.trim()) {
        next.firstName = contactPrefill.firstName.trim()
        changed = true
      }

      if (!next.lastName && contactPrefill.lastName?.trim()) {
        next.lastName = contactPrefill.lastName.trim()
        changed = true
      }

      if ((!next.firstName || !next.lastName) && contactPrefill.name?.trim()) {
        const nameParts = contactPrefill.name.trim().split(/\s+/)
        const firstName = nameParts[0] ?? ""
        const lastName = nameParts.slice(1).join(" ")

        if (!next.firstName && firstName) {
          next.firstName = firstName
          changed = true
        }

        if (!next.lastName && lastName) {
          next.lastName = lastName
          changed = true
        }
      }

      if (!next.email && contactPrefill.email?.trim()) {
        next.email = contactPrefill.email.trim()
        changed = true
      }

      if (!next.phone && contactPrefill.phone?.trim()) {
        next.phone = contactPrefill.phone.trim()
        changed = true
      }

      if (!next.company && contactPrefill.company?.trim()) {
        next.company = contactPrefill.company.trim()
        changed = true
      }

      const normalizedState = contactPrefill.state?.trim().toUpperCase()
      if (!next.state && normalizedState && stateOptions.includes(normalizedState as (typeof stateOptions)[number])) {
        next.state = normalizedState
        changed = true
      }

      const enquiryKey = contactPrefill.enquiry?.trim().toLowerCase()
      if (!next.enquiryType && enquiryKey) {
        const mapped = enquiryValueByKey.get(enquiryKey)
        if (mapped) {
          next.enquiryType = mapped
          changed = true
        }
      }

      const contactKey = contactPrefill.contact?.trim().toLowerCase().replaceAll(" ", "")
      if (!next.preferredContactMethod && contactKey) {
        const mapped = contactMethodValueByKey.get(contactKey)
        if (mapped) {
          next.preferredContactMethod = mapped
          changed = true
        }
      }

      if (!next.message && contactPrefill.message?.trim()) {
        next.message = contactPrefill.message.trim()
        changed = true
      }

      return changed ? next : previous
    })
  }, [contactMethodValueByKey, contactPrefill, enquiryValueByKey])

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
        setStatusMessage(body.error || submitErrorMessage.value)
        return
      }

      setStatusTone("success")
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
      updateFiles([])
      if (showTurnstile) {
        setShowTurnstile(false)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
      }
    } catch {
      setStatusTone("error")
      setStatusMessage(submitErrorMessage.value)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500" data-tina-field={introText.field}>{introText.value}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="firstName" data-tina-field={firstNameLabel.field}>{firstNameLabel.value}</Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="firstName"
            name="firstName"
            onChange={(event) => setFormValues((previous) => ({ ...previous, firstName: event.target.value }))}
            placeholder={firstNamePlaceholder.value}
            value={formValues.firstName}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="lastName" data-tina-field={lastNameLabel.field}>{lastNameLabel.value}</Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="lastName"
            name="lastName"
            onChange={(event) => setFormValues((previous) => ({ ...previous, lastName: event.target.value }))}
            placeholder={lastNamePlaceholder.value}
            value={formValues.lastName}
          />
        </div>
      </div>
      {errors.name ? <p className="text-xs text-[#d3582a]">{errors.name}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="email" data-tina-field={emailLabel.field}>{emailLabel.value}</Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="email"
            name="email"
            onChange={(event) => setFormValues((previous) => ({ ...previous, email: event.target.value }))}
            placeholder={emailPlaceholder.value}
            type="email"
            value={formValues.email}
          />
          {errors.email ? <p className="text-xs text-[#d3582a]">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="phone" data-tina-field={phoneLabel.field}>{phoneLabel.value}</Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="phone"
            name="phone"
            onChange={(event) => setFormValues((previous) => ({ ...previous, phone: event.target.value }))}
            placeholder={phonePlaceholder.value}
            value={formValues.phone}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="company" data-tina-field={companyLabel.field}>{companyLabel.value}</Label>
          <Input
            className="h-10 rounded-sm border-slate-200 bg-white text-slate-900"
            id="company"
            name="company"
            onChange={(event) => setFormValues((previous) => ({ ...previous, company: event.target.value }))}
            placeholder={companyPlaceholder.value}
            value={formValues.company}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="state" data-tina-field={stateLabel.field}>{stateLabel.value}</Label>
          <select
            className="h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-[#ff8b2b] transition focus:ring-2"
            id="state"
            name="state"
            onChange={(event) => setFormValues((previous) => ({ ...previous, state: event.target.value }))}
            value={formValues.state}
          >
            <option value="">{statePlaceholder.value}</option>
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
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" data-tina-field={enquiryTypeLabel.field}>{enquiryTypeLabel.value}</legend>
          <div className="space-y-1">
            {enquiryTypes.map((item) => (
              <label key={item.option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  checked={formValues.enquiryType === item.value}
                  className="size-3.5 accent-[#ff8b2b]"
                  name="enquiryType"
                  onChange={() => setFormValues((previous) => ({ ...previous, enquiryType: item.value }))}
                  type="radio"
                  value={item.value}
                />
                <span data-tina-field={item.field}>{item.value}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" data-tina-field={bestContactLabel.field}>{bestContactLabel.value}</legend>
          <div className="space-y-1">
            {contactMethods.map((item) => (
              <label key={item.option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  checked={formValues.preferredContactMethod === item.value}
                  className="size-3.5 accent-[#ff8b2b]"
                  name="preferredContactMethod"
                  onChange={() => setFormValues((previous) => ({ ...previous, preferredContactMethod: item.value }))}
                  type="radio"
                  value={item.value}
                />
                <span data-tina-field={item.field}>{item.value}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="message" data-tina-field={messageLabel.field}>{messageLabel.value}</Label>
        <Textarea
          className="min-h-28 rounded-sm border-slate-200 bg-white text-slate-900"
          id="message"
          name="message"
          onChange={(event) => setFormValues((previous) => ({ ...previous, message: event.target.value }))}
          placeholder={messagePlaceholder.value}
          rows={5}
          value={formValues.message}
        />
        {errors.message ? <p className="text-xs text-[#d3582a]">{errors.message}</p> : null}
      </div>

      <FileDropzone
        disabled={isSubmitting}
        error={fileError || undefined}
        files={files}
        hint={`Up to ${MAX_FORM_FILE_COUNT} files, max ${formatFileSize(MAX_FORM_FILE_BYTES)} each.`}
        id="contact-page-form-files"
        label="Attachments"
        onFileRemove={(file) => {
          updateFiles(files.filter((item) => item !== file))
        }}
        onFilesAdd={(incoming) => {
          updateFiles(mergeFiles(files, incoming, MAX_FORM_FILE_COUNT))
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{responseTime}</p>
        <Button
          className="rounded-sm bg-[#f47f2c] px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-white hover:bg-[#e56f1b]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? submitBusyLabel.value : submitIdleLabel.value}
        </Button>
      </div>

      {showTurnstile && turnstileEnabled ? (
        <div className="space-y-2 rounded-sm border border-slate-300 p-3">
          <TurnstileWidget
            action="contact_submit"
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
          className={`text-sm ${
            statusTone === "error"
              ? "text-[#d3582a]"
              : statusTone === "success"
                ? "text-emerald-700"
                : "text-slate-700"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}
    </form>
  )
}
