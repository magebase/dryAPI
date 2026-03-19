"use client"
/* eslint-disable react/no-children-prop */

import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/components/ui/file-dropzone"
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

const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  company: z.string().trim(),
  message: z.string().trim().min(10, "Please share more project details."),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

type ContactFormProps = {
  heading: string
  headingField?: string
  description: string
  descriptionField?: string
  responseTime: string
  site: SiteConfig
}

export function ContactForm({
  heading,
  headingField,
  description,
  descriptionField,
  responseTime,
  site,
}: ContactFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState("")
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
    "Tell us about your timeline, scope, and site requirements",
  )
  const submitIdleLabel = resolveSiteUiText(site, "contactForm.submitIdleLabel", "Send Inquiry")
  const submitBusyLabel = resolveSiteUiText(site, "contactForm.submitBusyLabel", "Sending...")
  const submitErrorMessage = resolveSiteUiText(
    site,
    "contactForm.submitErrorMessage",
    "We could not submit your request right now.",
  )

  const submitMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      const nextFileError = validateFiles(files)
      if (nextFileError) {
        throw new Error(nextFileError)
      }

      const formData = buildContactFormData(values as Record<string, string>, files)
      const response = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      })

      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null

      if (!response.ok || !body?.ok) {
        throw new Error(body?.message || submitErrorMessage.value)
      }

      return body
    },
    onSuccess: (body) => {
      const successMessage = body.message ?? "Thanks - your message has been sent."
      setStatusMessage(successMessage)
      toast.success("Message sent", {
        description: successMessage,
      })
      form.reset({
        name: "",
        email: "",
        company: "",
        message: "",
      })
      setFiles([])
      setFileError("")
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : submitErrorMessage.value
      setStatusMessage(message)
      toast.error("Message not sent", {
        description: message,
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
    },
    validators: {
      onSubmit: contactFormSchema,
    },
    onSubmit: async ({ value }) => {
      setStatusMessage("")
      const nextFileError = validateFiles(files)
      if (nextFileError) {
        setFileError(nextFileError)
        throw new Error(nextFileError)
      }

      setFileError("")
      await submitMutation.mutateAsync(value)
    },
  })

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles)
    setFileError(validateFiles(nextFiles) || "")
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-primary" data-tina-field={projectEnquiryLabel.field}>
          {projectEnquiryLabel.value}
        </p>
        <h2 className="text-site-strong mt-2 font-display text-3xl uppercase tracking-[0.08em]" data-tina-field={headingField}>
          {heading}
        </h2>
        <p className="text-site-muted mt-2" data-tina-field={descriptionField}>
          {description}
        </p>
      </div>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <form.Field
            name="name"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div className="space-y-2">
                  <Label className="text-site-muted" htmlFor={field.name} data-tina-field={nameLabel.field}>
                    {nameLabel.value}
                  </Label>
                  <Input
                    className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={namePlaceholder.value}
                    value={field.state.value}
                  />
                  {isInvalid ? <p className="text-sm text-primary">{errorMessage}</p> : null}
                </div>
              )
            }}
          />

          <form.Field
            name="email"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div className="space-y-2">
                  <Label className="text-site-muted" htmlFor={field.name} data-tina-field={emailLabel.field}>
                    {emailLabel.value}
                  </Label>
                  <Input
                    className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={emailPlaceholder.value}
                    type="email"
                    value={field.state.value}
                  />
                  {isInvalid ? <p className="text-sm text-primary">{errorMessage}</p> : null}
                </div>
              )
            }}
          />
        </div>

        <form.Field
          name="company"
          children={(field) => (
            <div className="space-y-2">
              <Label className="text-site-muted" htmlFor={field.name} data-tina-field={companyLabel.field}>
                {companyLabel.value}
              </Label>
              <Input
                className="text-site-strong h-10 border-slate-300 bg-[var(--site-surface-0)]"
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
          name="message"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

            return (
              <div className="space-y-2">
                <Label className="text-site-muted" htmlFor={field.name} data-tina-field={messageLabel.field}>
                  {messageLabel.value}
                </Label>
                <Textarea
                  className="text-site-strong border-slate-300 bg-[var(--site-surface-0)]"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={messagePlaceholder.value}
                  rows={6}
                  value={field.state.value}
                />
                {isInvalid ? <p className="text-sm text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <FileDropzone
          disabled={submitMutation.isPending || form.state.isSubmitting}
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
            disabled={submitMutation.isPending || form.state.isSubmitting}
            type="submit"
          >
            {submitMutation.isPending || form.state.isSubmitting ? submitBusyLabel.value : submitIdleLabel.value}
          </Button>
        </div>
        {statusMessage ? <p className="text-site-muted text-sm">{statusMessage}</p> : null}
      </form>
    </section>
  )
}
