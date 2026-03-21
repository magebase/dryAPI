"use client";
/* eslint-disable react/no-children-prop */

import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { toast } from "sonner";
import { z } from "zod";

import { TurnstileWidget } from "@/components/site/turnstile-widget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildContactFormData } from "@/lib/contact-form-submission";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import {
  formatFileSize,
  MAX_FORM_FILE_BYTES,
  MAX_FORM_FILE_COUNT,
  mergeFiles,
  validateFiles,
} from "@/lib/form-file-utils";
import type { SiteConfig } from "@/lib/site-content-schema";
import { cn } from "@/lib/utils";

type QuoteDialogProps = {
  site: SiteConfig;
  triggerLabel: string;
  triggerClassName?: string;
  triggerTinaField?: string;
};

type QuoteFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  projectSuburbPostcode: string;
  enquiryStream: string;
  interest: string;
  deliveryDetails: string;
  notes: string;
};

const OPEN_QUOTE_DIALOG_EVENT = "dryapi:open-quote-dialog";

export function openQuoteDialog() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(OPEN_QUOTE_DIALOG_EVENT));
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
};

const quoteFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  email: z.string().trim().email("Email is required."),
  companyName: z.string().trim(),
  phoneNumber: z.string().trim(),
  projectSuburbPostcode: z
    .string()
    .trim()
    .min(1, "Postcode/suburb of project is required."),
  enquiryStream: z.string().trim().min(1, "Please choose rental or sales."),
  interest: z
    .string()
    .trim()
    .min(1, "Please select what you are interested in."),
  deliveryDetails: z
    .string()
    .trim()
    .min(1, "Please add your delivery details."),
  notes: z.string().trim(),
});

function buildMessage(values: QuoteFormValues) {
  return [
    "Quote request details",
    `Project suburb/postcode: ${values.projectSuburbPostcode}`,
    `Interested in: ${values.interest}`,
    `Delivery details: ${values.deliveryDetails}`,
    `Additional notes: ${values.notes || "Not provided"}`,
  ].join("\n");
}

export function QuoteDialog({
  site,
  triggerLabel,
  triggerClassName,
  triggerTinaField,
}: QuoteDialogProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error" | "neutral">(
    "neutral",
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [quoteQuery, setQuoteQuery] = useQueryState(
    "quote",
    parseAsStringLiteral(["open"]).withOptions({
      history: "replace",
      scroll: false,
      shallow: true,
    }),
  );
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
    },
  );

  const dialogTitle = resolveSiteUiText(
    site,
    "quoteDialog.title",
    "Get A Quote",
  );
  const dialogDescription = resolveSiteUiText(
    site,
    "quoteDialog.description",
    "Share a few project details and our team will get back to you quickly.",
  );
  const requiredHint = resolveSiteUiText(
    site,
    "quoteDialog.requiredHint",
    "Required fields are marked with an asterisk.",
  );
  const fieldFirstName = resolveSiteUiText(
    site,
    "quoteDialog.field.firstName",
    "First name*",
  );
  const fieldLastName = resolveSiteUiText(
    site,
    "quoteDialog.field.lastName",
    "Last name*",
  );
  const fieldEmail = resolveSiteUiText(
    site,
    "quoteDialog.field.email",
    "Email*",
  );
  const fieldCompany = resolveSiteUiText(
    site,
    "quoteDialog.field.company",
    "Company name",
  );
  const fieldPhone = resolveSiteUiText(
    site,
    "quoteDialog.field.phone",
    "Phone number",
  );
  const fieldPostcode = resolveSiteUiText(
    site,
    "quoteDialog.field.postcode",
    "Postcode/suburb of project*",
  );
  const fieldEnquiry = resolveSiteUiText(
    site,
    "quoteDialog.field.enquiry",
    "Are you enquiring about rental or sales?*",
  );
  const fieldInterest = resolveSiteUiText(
    site,
    "quoteDialog.field.interest",
    "What are you interested in?*",
  );
  const fieldDelivery = resolveSiteUiText(
    site,
    "quoteDialog.field.delivery",
    "Do you need delivery? (If yes please enter suburb/postcode, if no move to next)*",
  );
  const fieldNotes = resolveSiteUiText(
    site,
    "quoteDialog.field.notes",
    "Any other notes or comments?",
  );
  const selectPlaceholder = resolveSiteUiText(
    site,
    "quoteDialog.select.placeholder",
    "Please Select",
  );
  const responseTime = resolveSiteUiText(
    site,
    "quoteDialog.responseTime",
    "We usually respond within one business day.",
  );
  const submitIdle = resolveSiteUiText(
    site,
    "quoteDialog.submitIdle",
    "Submit",
  );
  const submitBusy = resolveSiteUiText(
    site,
    "quoteDialog.submitBusy",
    "Submitting...",
  );
  const submitError = resolveSiteUiText(
    site,
    "quoteDialog.submitError",
    "We could not submit your request right now.",
  );
  const submitSuccess = resolveSiteUiText(
    site,
    "quoteDialog.submitSuccess",
    "Thanks, your quote request has been sent.",
  );

  const enquiryOptions = useMemo(
    () => [
      resolveSiteUiText(site, "quoteDialog.enquiryOption.rental", "Rental"),
      resolveSiteUiText(site, "quoteDialog.enquiryOption.sales", "Sales"),
    ],
    [site],
  );
  const interestOptions = useMemo(
    () => [
      resolveSiteUiText(
        site,
        "quoteDialog.interestOption.generators",
        "Generators",
      ),
      resolveSiteUiText(
        site,
        "quoteDialog.interestOption.lighting",
        "Lighting",
      ),
      resolveSiteUiText(
        site,
        "quoteDialog.interestOption.airTools",
        "Air Power Tools",
      ),
      resolveSiteUiText(site, "quoteDialog.interestOption.welders", "Welders"),
      resolveSiteUiText(
        site,
        "quoteDialog.interestOption.solar",
        "Solar Generators",
      ),
      resolveSiteUiText(
        site,
        "quoteDialog.interestOption.service",
        "Service Support",
      ),
      resolveSiteUiText(site, "quoteDialog.interestOption.other", "Other"),
    ],
    [site],
  );
  const enquiryValueByParam = useMemo(
    () => ({
      rental: enquiryOptions[0]?.value,
      sales: enquiryOptions[1]?.value,
    }),
    [enquiryOptions],
  );
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
    [interestOptions],
  );

  const submitMutation = useMutation({
    mutationFn: async (values: QuoteFormValues) => {
      if (showTurnstile && turnstileEnabled && !turnstileToken) {
        throw new Error(
          "Please complete the verification challenge before submitting again.",
        );
      }

      const nextFileError = validateFiles(files);
      if (nextFileError) {
        throw new Error(nextFileError);
      }

      const parsed = quoteFormSchema.safeParse(values);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || submitError.value);
      }

      const payload = {
        submissionType: "quote" as const,
        name: [values.firstName.trim(), values.lastName.trim()]
          .filter(Boolean)
          .join(" "),
        email: values.email,
        company: values.companyName,
        phone: values.phoneNumber,
        enquiryType: values.enquiryStream,
        message: buildMessage(values),
      };

      const formData = buildContactFormData(
        payload as Record<string, string>,
        files,
        turnstileToken,
      );

      const response = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        requiresTurnstile?: boolean;
      };

      if (response.status === 429 && body.requiresTurnstile) {
        throw new Error(
          body.error || "Please complete verification before submitting again.",
        );
      }

      if (!response.ok || !body.ok) {
        throw new Error(body.error || submitError.value);
      }

      return body;
    },
    onSuccess: (body) => {
      const successMessage = body.message ?? submitSuccess.value;
      setStatusTone("success");
      setStatusMessage(successMessage);
      toast.success("Quote request sent", {
        description: successMessage,
      });
      form.reset(INITIAL_VALUES);
      setFiles([]);
      setFileError("");
      if (showTurnstile) {
        setShowTurnstile(false);
        setTurnstileToken("");
        setTurnstileResetKey((previous) => previous + 1);
      }
      setTimeout(() => {
        handleOpenChange(false);
        setStatusTone("neutral");
        setStatusMessage("");
      }, 1200);
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : submitError.value;
      setStatusTone("error");
      setStatusMessage(message);
      toast.error("Quote request not sent", {
        description: message,
      });
    },
  });

  const form = useForm({
    defaultValues: INITIAL_VALUES,
    validators: {
      onSubmit: quoteFormSchema,
    },
    onSubmit: async ({ value }) => {
      setStatusTone("neutral");
      setStatusMessage("");
      await submitMutation.mutateAsync(value);
    },
  });

  useEffect(() => {
    setIsHydrated(true);

    const handleOpenRequest = () => {
      setOpen(true);
    };

    window.addEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest);

    return () => {
      window.removeEventListener(OPEN_QUOTE_DIALOG_EVENT, handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (quoteQuery === "open") {
      setOpen(true);
    }
  }, [quoteQuery]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && quoteQuery) {
      void setQuoteQuery(null);
    }
  }

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    setFileError(validateFiles(nextFiles) || "");
  }

  function syncPrefill() {
    const fields: Array<[keyof QuoteFormValues, string | null | undefined]> = [
      ["email", quotePrefill.email],
      ["companyName", quotePrefill.company],
      ["phoneNumber", quotePrefill.phone],
      ["projectSuburbPostcode", quotePrefill.suburb],
      ["deliveryDetails", quotePrefill.delivery],
      ["notes", quotePrefill.notes],
    ];

    for (const [field, value] of fields) {
      if (value?.trim()) {
        form.setFieldValue(field, value.trim());
      }
    }

    const enquiryParam = quotePrefill.enquiry?.trim().toLowerCase();
    if (enquiryParam) {
      const mapped =
        enquiryValueByParam[enquiryParam as keyof typeof enquiryValueByParam];
      if (mapped) {
        form.setFieldValue("enquiryStream", mapped);
      }
    }

    const interestParam = quotePrefill.interest?.trim().toLowerCase();
    if (interestParam) {
      const mapped =
        interestValueByParam[
          interestParam as keyof typeof interestValueByParam
        ];
      if (mapped) {
        form.setFieldValue("interest", mapped);
      }
    }
  }

  useEffect(() => {
    syncPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotePrefill, enquiryValueByParam, interestValueByParam]);

  if (!isHydrated) {
    return (
      <button
        className={cn(triggerClassName)}
        data-tina-field={triggerTinaField}
        type="button"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className={cn(triggerClassName)}
          data-tina-field={triggerTinaField}
          type="button"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="z-[60] max-h-[88vh] overflow-y-auto border-slate-200 bg-white p-6 text-site-strong sm:max-w-[46rem]">
        <DialogHeader className="space-y-1">
          <DialogTitle
            className="font-display text-2xl uppercase tracking-[0.06em] text-[#101a28]"
            data-tina-field={dialogTitle.field}
          >
            {dialogTitle.value}
          </DialogTitle>
          <DialogDescription
            className="text-sm text-slate-600"
            data-tina-field={dialogDescription.field}
          >
            {dialogDescription.value}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <p
            className="text-xs uppercase tracking-[0.15em] text-site-muted"
            data-tina-field={requiredHint.field}
          >
            {requiredHint.value}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field
              name="firstName"
              children={(field) =>
                renderTextField(field, fieldFirstName, "quote-first-name")
              }
            />
            <form.Field
              name="lastName"
              children={(field) =>
                renderTextField(field, fieldLastName, "quote-last-name")
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field
              name="email"
              children={(field) =>
                renderEmailField(field, fieldEmail, "quote-email")
              }
            />
            <form.Field
              name="companyName"
              children={(field) =>
                renderTextField(field, fieldCompany, "quote-company")
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field
              name="phoneNumber"
              children={(field) =>
                renderTextField(field, fieldPhone, "quote-phone")
              }
            />
            <form.Field
              name="projectSuburbPostcode"
              children={(field) =>
                renderTextField(field, fieldPostcode, "quote-postcode")
              }
            />
          </div>

          <form.Field
            name="enquiryStream"
            children={(field) => (
              <div className="space-y-2">
                <Label
                  className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600"
                  htmlFor={field.name}
                  data-tina-field={fieldEnquiry.field}
                >
                  {fieldEnquiry.value}
                </Label>
                <select
                  className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-site-strong outline-none ring-primary transition focus:ring-2"
                  id={field.name}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <option value="">{selectPlaceholder.value}</option>
                  {enquiryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />

          <form.Field
            name="interest"
            children={(field) => (
              <div className="space-y-2">
                <Label
                  className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600"
                  htmlFor={field.name}
                  data-tina-field={fieldInterest.field}
                >
                  {fieldInterest.value}
                </Label>
                <select
                  className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-site-strong outline-none ring-primary transition focus:ring-2"
                  id={field.name}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <option value="">{selectPlaceholder.value}</option>
                  {interestOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />

          <form.Field
            name="deliveryDetails"
            children={(field) =>
              renderTextField(field, fieldDelivery, "quote-delivery")
            }
          />

          <form.Field
            name="notes"
            children={(field) =>
              renderTextareaField(field, fieldNotes, "quote-notes")
            }
          />

          <FileDropzone
            disabled={submitMutation.isPending || form.state.isSubmitting}
            error={fileError || undefined}
            files={files}
            hint={`Up to ${MAX_FORM_FILE_COUNT} files, max ${formatFileSize(MAX_FORM_FILE_BYTES)} each.`}
            id="quote-form-files"
            label="Attachments"
            onFileRemove={(file) => {
              updateFiles(files.filter((item) => item !== file));
            }}
            onFilesAdd={(incoming) => {
              updateFiles(mergeFiles(files, incoming, MAX_FORM_FILE_COUNT));
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p
              className="text-xs text-site-muted"
              data-tina-field={responseTime.field}
            >
              {responseTime.value}
            </p>
            <Button
              className="rounded-sm bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary-foreground hover:bg-accent"
              disabled={submitMutation.isPending || form.state.isSubmitting}
              type="submit"
            >
              {submitMutation.isPending || form.state.isSubmitting
                ? submitBusy.value
                : submitIdle.value}
            </Button>
          </div>

          {showTurnstile && turnstileEnabled ? (
            <div className="space-y-2 rounded-sm border border-slate-300 p-3">
              <TurnstileWidget
                action="quote_submit"
                className="min-h-[65px]"
                onError={() => {
                  setStatusTone("error");
                  setStatusMessage(
                    "Verification failed. Please retry the challenge.",
                  );
                }}
                onTokenChange={setTurnstileToken}
                resetKey={turnstileResetKey}
              />
              <p className="text-xs text-site-muted">
                Verification is required after frequent submissions.
              </p>
            </div>
          ) : null}

          {statusMessage ? (
            <p
              className={cn(
                "text-sm",
                statusTone === "error"
                  ? "text-primary"
                  : statusTone === "success"
                    ? "text-emerald-700"
                    : "text-slate-700",
              )}
            >
              {statusMessage}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );

  function renderTextField(
    field: {
      name: string;
      state: {
        value: string;
        meta: { isTouched: boolean; isValid: boolean; errors: unknown[] };
      };
      handleBlur: () => void;
      handleChange: (value: string) => void;
    },
    label: { field?: string; value: string },
    id: string,
  ) {
    const isInvalid =
      (field.state.meta.isTouched || form.state.isSubmitted) &&
      !field.state.meta.isValid;
    const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "");

    return (
      <div className="space-y-2">
        <Label
          className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600"
          htmlFor={id}
          data-tina-field={label.field}
        >
          {label.value}
        </Label>
        <Input
          className="h-10 rounded-sm border-slate-300 bg-white text-site-strong"
          id={id}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          value={field.state.value}
        />
        {isInvalid ? (
          <p className="text-xs text-primary">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  function renderEmailField(
    field: {
      name: string;
      state: {
        value: string;
        meta: { isTouched: boolean; isValid: boolean; errors: unknown[] };
      };
      handleBlur: () => void;
      handleChange: (value: string) => void;
    },
    label: { field?: string; value: string },
    id: string,
  ) {
    const isInvalid =
      (field.state.meta.isTouched || form.state.isSubmitted) &&
      !field.state.meta.isValid;
    const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "");

    return (
      <div className="space-y-2">
        <Label
          className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600"
          htmlFor={id}
          data-tina-field={label.field}
        >
          {label.value}
        </Label>
        <Input
          className="h-10 rounded-sm border-slate-300 bg-white text-site-strong"
          id={id}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          type="email"
          value={field.state.value}
        />
        {isInvalid ? (
          <p className="text-xs text-primary">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  function renderTextareaField(
    field: {
      name: string;
      state: {
        value: string;
        meta: { isTouched: boolean; isValid: boolean; errors: unknown[] };
      };
      handleBlur: () => void;
      handleChange: (value: string) => void;
    },
    label: { field?: string; value: string },
    id: string,
  ) {
    const isInvalid =
      (field.state.meta.isTouched || form.state.isSubmitted) &&
      !field.state.meta.isValid;
    const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "");

    return (
      <div className="space-y-2">
        <Label
          className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600"
          htmlFor={id}
          data-tina-field={label.field}
        >
          {label.value}
        </Label>
        <Textarea
          className="min-h-20 rounded-sm border-slate-300 bg-white text-site-strong"
          id={id}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          rows={3}
          value={field.state.value}
        />
        {isInvalid ? (
          <p className="text-xs text-primary">{errorMessage}</p>
        ) : null}
      </div>
    );
  }
}
