"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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

type ContactFormProps = {
  heading: string
  headingField?: string
  description: string
  descriptionField?: string
  responseTime: string
  site: SiteConfig
}

type FormErrors = Partial<Record<"name" | "email" | "message", string>>

export function ContactForm({
  heading,
  headingField,
  description,
  descriptionField,
  responseTime,
  site,
}: ContactFormProps) {
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const projectEnquiryLabel = resolveSiteUiText(site, "contactForm.projectEnquiryLabel", "Project Enquiry")
  const nameLabel = resolveSiteUiText(site, "contactForm.nameLabel", "Name")
  const namePlaceholder = resolveSiteUiText(site, "contactForm.namePlaceholder", "Your name")
  const emailLabel = resolveSiteUiText(site, "contactForm.emailLabel", "Email")
  const emailPlaceholder = resolveSiteUiText(site, "contactForm.emailPlaceholder", "you@company.com")
  const companyLabel = resolveSiteUiText(site, "contactForm.companyLabel", "Company")
  const companyPlaceholder = resolveSiteUiText(site, "contactForm.companyPlaceholder", "Optional")
  const messageLabel = resolveSiteUiText(site, "contactForm.messageLabel", "Project details")
  const messagePlaceholder = resolveSiteUiText(
    site,
    "contactForm.messagePlaceholder",
    "Tell us about your timeline, scope, and site requirements"
  )
  const submitIdleLabel = resolveSiteUiText(site, "contactForm.submitIdleLabel", "Send Inquiry")
  const submitBusyLabel = resolveSiteUiText(site, "contactForm.submitBusyLabel", "Sending...")
  const submitErrorMessage = resolveSiteUiText(
    site,
    "contactForm.submitErrorMessage",
    "We could not submit your request right now."
  )

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles)
    setFileError(validateFiles(nextFiles) || "")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatusMessage("")

    const nextFileError = validateFiles(files)
    if (nextFileError) {
      setFileError(nextFileError)
      toast.error("Please fix file attachments", {
        description: nextFileError,
      })
      return
    }

    const parsed = contactSubmissionSchema.safeParse(formValues)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        message: fieldErrors.message?.[0],
      })
      toast.error("Please correct the highlighted fields")
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const formData = buildContactFormData(parsed.data as Record<string, string>, files)

      const response = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      })

      const body = (await response.json()) as { ok?: boolean; message?: string }

      if (!response.ok || !body.ok) {
        setStatusMessage(submitErrorMessage.value)
        toast.error("Message not sent", {
          description: submitErrorMessage.value,
        })
        return
      }

      const successMessage = body.message ?? "Thanks - your message has been sent."
      setStatusMessage(successMessage)
      toast.success("Message sent", {
        description: successMessage,
      })
      setFormValues({
        name: "",
        email: "",
        company: "",
        message: "",
      })
      updateFiles([])
    } catch {
      setStatusMessage(submitErrorMessage.value)
      toast.error("Message not sent", {
        description: submitErrorMessage.value,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-primary" data-tina-field={projectEnquiryLabel.field}>{projectEnquiryLabel.value}</p>
        <h2 className="text-site-strong mt-2 font-display text-3xl uppercase tracking-[0.08em]" data-tina-field={headingField}>{heading}</h2>
        <p className="text-site-muted mt-2" data-tina-field={descriptionField}>{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-site-muted" htmlFor="name" data-tina-field={nameLabel.field}>{nameLabel.value}</Label>
            <Input
              className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
              id="name"
              name="name"
              onChange={(event) =>
                setFormValues((previous) => ({ ...previous, name: event.target.value }))
              }
              placeholder={namePlaceholder.value}
              value={formValues.name}
            />
            {errors.name ? <p className="text-sm text-primary">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-site-muted" htmlFor="email" data-tina-field={emailLabel.field}>{emailLabel.value}</Label>
            <Input
              className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
              id="email"
              name="email"
              onChange={(event) =>
                setFormValues((previous) => ({ ...previous, email: event.target.value }))
              }
              placeholder={emailPlaceholder.value}
              type="email"
              value={formValues.email}
            />
            {errors.email ? <p className="text-sm text-primary">{errors.email}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-site-muted" htmlFor="company" data-tina-field={companyLabel.field}>{companyLabel.value}</Label>
          <Input
            className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
            id="company"
            name="company"
            onChange={(event) =>
              setFormValues((previous) => ({ ...previous, company: event.target.value }))
            }
            placeholder={companyPlaceholder.value}
            value={formValues.company}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-site-muted" htmlFor="message" data-tina-field={messageLabel.field}>{messageLabel.value}</Label>
          <Textarea
            className="text-site-strong border-slate-300 bg-[var(--site-surface-0)]"
            id="message"
            name="message"
            onChange={(event) =>
              setFormValues((previous) => ({ ...previous, message: event.target.value }))
            }
            placeholder={messagePlaceholder.value}
            rows={6}
            value={formValues.message}
          />
          {errors.message ? <p className="text-sm text-primary">{errors.message}</p> : null}
        </div>

        <FileDropzone
          disabled={isSubmitting}
          error={fileError || undefined}
          files={files}
          hint={`Up to ${MAX_FORM_FILE_COUNT} files, max ${formatFileSize(MAX_FORM_FILE_BYTES)} each.`}
          id="contact-form-files"
          label="Attachments"
          onFileRemove={(file) => {
            updateFiles(files.filter((item) => item !== file))
          }}
          onFilesAdd={(incoming) => {
            updateFiles(mergeFiles(files, incoming, MAX_FORM_FILE_COUNT))
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-site-soft text-sm uppercase tracking-[0.14em]">{responseTime}</p>
          <Button
            className="rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground shadow-lg transition hover:brightness-110"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? submitBusyLabel.value : submitIdleLabel.value}
          </Button>
        </div>
        {statusMessage ? <p className="text-site-muted text-sm">{statusMessage}</p> : null}
      </form>
    </section>
  )
}
