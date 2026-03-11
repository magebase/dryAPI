import { appendFilesToFormData } from "@/lib/form-file-utils"

export function buildContactFormData(
  fields: Record<string, string>,
  files: File[],
  turnstileToken = ""
): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }

  if (turnstileToken.trim().length > 0) {
    formData.set("turnstileToken", turnstileToken)
  }

  appendFilesToFormData(formData, files)

  return formData
}
