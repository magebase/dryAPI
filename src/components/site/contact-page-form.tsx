"use client"
/* eslint-disable react/no-children-prop */

import { useEffect, useMemo, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { parseAsString, useQueryStates } from "nuqs"
import { toast } from "sonner"
import { z } from "zod"

import { TurnstileWidget } from "@/components/site/turnstile-widget"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { buildContactFormData } from "@/lib/contact-form-submission"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import {
  formatFileSize,
  MAX_FORM_FILE_BYTES,
  MAX_FORM_FILE_COUNT,
  mergeFiles,
  validateFiles,
} from "@/lib/form-file-utils"
import type { SiteConfig } from "@/lib/site-content-schema"

const defaultEnquiryTypes = ["Sales", "Rental", "Service", "Parts", "Other"] as const
const defaultContactMethods = ["Call me", "Email me"] as const
const stateOptions = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const

const contactPageSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  email: z.string().trim().email("Please enter a valid email address."),
  phone: z.string().trim(),
  company: z.string().trim(),
  state: z.string().trim(),
  enquiryType: z.string().trim().min(1, "Please choose an enquiry type."),
  preferredContactMethod: z.string().trim().min(1, "Please choose a contact method."),
  message: z.string().trim().min(10, "Please share more project details."),
})

type ContactPageFormValues = z.infer<typeof contactPageSchema>

type ContactPageFormProps = {
  responseTime: string
  site: SiteConfig
}

export function ContactPageForm({ responseTime, site }: ContactPageFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState("")
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
    },
  )

  const introText = resolveSiteUiText(
    site,
    "contactPageForm.introText",
    "Complete the fields below and we will route your enquiry to the right specialist.",
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
  const bestContactLabel = resolveSiteUiText(site, "contactPageForm.bestContactLabel", "What is the best way to contact you?")
  const messageLabel = resolveSiteUiText(site, "contactPageForm.messageLabel", "Message")
  const messagePlaceholder = resolveSiteUiText(site, "contactPageForm.messagePlaceholder", "Tell us about your project requirements")
  const submitIdleLabel = resolveSiteUiText(site, "contactPageForm.submitIdleLabel", "Submit")
  const submitBusyLabel = resolveSiteUiText(site, "contactPageForm.submitBusyLabel", "Sending...")
  const submitErrorMessage = resolveSiteUiText(site, "contactPageForm.submitErrorMessage", "We could not submit your request right now.")
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

  const submitMutation = useMutation({
    mutationFn: async (values: ContactPageFormValues) => {
      if (showTurnstile && turnstileEnabled && !turnstileToken) {
        throw new Error("Please complete the verification challenge before submitting again.")
      }

      const nextFileError = validateFiles(files)
      if (nextFileError) {
        throw new Error(nextFileError)
      }

      const parsed = z.object({
        name: z.string().trim().min(2),
        email: z.string().trim().email(),
        company: z.string().trim(),
        phone: z.string().trim(),
        state: z.string().trim(),
        enquiryType: z.string().trim(),
        preferredContactMethod: z.string().trim(),
        message: z.string().trim().min(10),
      }).safeParse({
        name: [values.firstName.trim(), values.lastName.trim()].filter(Boolean).join(" "),
        email: values.email,
        company: values.company,
        phone: values.phone,
        state: values.state,
        enquiryType: values.enquiryType,
        preferredContactMethod: values.preferredContactMethod,
        message: values.message,
      })

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || submitErrorMessage.value)
      }

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
        throw new Error(body.error || "Please complete verification before submitting again.")
      }

      if (!response.ok || !body.ok) {
        throw new Error(body.error || submitErrorMessage.value)
      }

      return body
    },
    onSuccess: (body) => {
      const successMessage = body.message ?? "Thanks, your message has been sent."
      setStatusTone("success")
      setStatusMessage(successMessage)
      toast.success("Message sent", {
        description: successMessage,
      })
      form.reset({
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
      setFiles([])
      setFileError("")
      if (showTurnstile) {
        setShowTurnstile(false)
        setTurnstileToken("")
        setTurnstileResetKey((previous) => previous + 1)
      }
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : submitErrorMessage.value
      setStatusTone("error")
      setStatusMessage(message)
      toast.error("Message not sent", {
        description: message,
      })
    },
  })

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      state: "",
      enquiryType: "",
      preferredContactMethod: "",
      message: "",
    },
    validators: {
      onSubmit: contactPageSchema,
    },
    onSubmit: async ({ value }) => {
      setStatusTone("neutral")
      setStatusMessage("")
      await submitMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    setStatusMessage("")
    setFormFieldFromPrefill("firstName", contactPrefill.firstName)
    setFormFieldFromPrefill("lastName", contactPrefill.lastName)
    setFormFieldFromPrefill("email", contactPrefill.email)
    setFormFieldFromPrefill("phone", contactPrefill.phone)
    setFormFieldFromPrefill("company", contactPrefill.company)
    setFormFieldFromPrefill("message", contactPrefill.message)

    const normalizedState = contactPrefill.state?.trim().toUpperCase()
    if (normalizedState && stateOptions.includes(normalizedState as (typeof stateOptions)[number])) {
      form.setFieldValue("state", normalizedState)
    }

    const enquiryKey = contactPrefill.enquiry?.trim().toLowerCase()
    if (enquiryKey) {
      const mapped = enquiryValueByKey.get(enquiryKey)
      if (mapped) {
        form.setFieldValue("enquiryType", mapped)
      }
    }

    const contactKey = contactPrefill.contact?.trim().toLowerCase().replaceAll(" ", "")
    if (contactKey) {
      const mapped = contactMethodValueByKey.get(contactKey)
      if (mapped) {
        form.setFieldValue("preferredContactMethod", mapped)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactPrefill, enquiryValueByKey, contactMethodValueByKey])

  function setFormFieldFromPrefill(field: keyof ContactPageFormValues, value: string | null | undefined) {
    if (value?.trim()) {
      form.setFieldValue(field, value.trim())
    }
  }

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles)
    setFileError(validateFiles(nextFiles) || "")
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-site-muted" data-tina-field={introText.field}>
        {introText.value}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <form.Field
          name="firstName"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
            return (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={firstNameLabel.field}>
                  {firstNameLabel.value}
                </Label>
                <Input
                  className="h-10 rounded-sm border-slate-200 bg-white text-site-strong"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={firstNamePlaceholder.value}
                  value={field.state.value}
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <form.Field
          name="lastName"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
            return (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={lastNameLabel.field}>
                  {lastNameLabel.value}
                </Label>
                <Input
                  className="h-10 rounded-sm border-slate-200 bg-white text-site-strong"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={lastNamePlaceholder.value}
                  value={field.state.value}
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <form.Field
          name="email"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
            return (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={emailLabel.field}>
                  {emailLabel.value}
                </Label>
                <Input
                  className="h-10 rounded-sm border-slate-200 bg-white text-site-strong"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={emailPlaceholder.value}
                  type="email"
                  value={field.state.value}
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <form.Field
          name="phone"
          children={(field) => (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={phoneLabel.field}>
                {phoneLabel.value}
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-200 bg-white text-site-strong"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={phonePlaceholder.value}
                value={field.state.value}
              />
            </div>
          )}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <form.Field
          name="company"
          children={(field) => (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={companyLabel.field}>
                {companyLabel.value}
              </Label>
              <Input
                className="h-10 rounded-sm border-slate-200 bg-white text-site-strong"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={companyPlaceholder.value}
                value={field.state.value}
              />
            </div>
          )}
        />

        <form.Field
          name="state"
          children={(field) => (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={stateLabel.field}>
                {stateLabel.value}
              </Label>
              <select
                className="h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-site-strong outline-none ring-primary transition focus:ring-2"
                id={field.name}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <option value="">{statePlaceholder.value}</option>
                {stateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form.Field
          name="enquiryType"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
            return (
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" data-tina-field={enquiryTypeLabel.field}>
                  {enquiryTypeLabel.value}
                </legend>
                <div className="space-y-1">
                  {enquiryTypes.map((item) => (
                    <label key={item.option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        checked={field.state.value === item.value}
                        className="size-3.5 accent-primary"
                        name={field.name}
                        onChange={() => field.handleChange(item.value)}
                        type="radio"
                        value={item.value}
                      />
                      <span data-tina-field={item.field}>{item.value}</span>
                    </label>
                  ))}
                </div>
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </fieldset>
            )
          }}
        />

        <form.Field
          name="preferredContactMethod"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
            return (
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" data-tina-field={bestContactLabel.field}>
                  {bestContactLabel.value}
                </legend>
                <div className="space-y-1">
                  {contactMethods.map((item) => (
                    <label key={item.option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        checked={field.state.value === item.value}
                        className="size-3.5 accent-primary"
                        name={field.name}
                        onChange={() => field.handleChange(item.value)}
                        type="radio"
                        value={item.value}
                      />
                      <span data-tina-field={item.field}>{item.value}</span>
                    </label>
                  ))}
                </div>
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </fieldset>
            )
          }}
        />
      </div>

      <form.Field
        name="message"
        children={(field) => {
          const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
          const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")
          return (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor={field.name} data-tina-field={messageLabel.field}>
                {messageLabel.value}
              </Label>
              <Textarea
                className="min-h-28 rounded-sm border-slate-200 bg-white text-site-strong"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={messagePlaceholder.value}
                rows={5}
                value={field.state.value}
              />
              {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
            </div>
          )
        }}
      />

      <FileDropzone
        disabled={submitMutation.isPending || form.state.isSubmitting}
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
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-site-muted">{responseTime}</p>
        <Button
          className="rounded-sm bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary-foreground hover:bg-accent"
          disabled={submitMutation.isPending || form.state.isSubmitting}
          type="submit"
        >
          {submitMutation.isPending || form.state.isSubmitting ? submitBusyLabel.value : submitIdleLabel.value}
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
          <p className="text-xs text-site-muted">Verification is required after frequent submissions.</p>
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className={`text-sm ${
            statusTone === "error"
              ? "text-primary"
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
