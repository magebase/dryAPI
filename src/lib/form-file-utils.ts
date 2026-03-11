const BYTES_IN_KB = 1024
const BYTES_IN_MB = BYTES_IN_KB * 1024

export const FORM_UPLOAD_FIELD_NAME = "files"
export const MAX_FORM_FILE_BYTES = 10 * BYTES_IN_MB
export const MAX_FORM_FILE_COUNT = 3
export const TEXT_FILE_SNIPPET_LIMIT = 8_000

const TEXT_MIME_PREFIXES = ["text/"]
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/csv",
])

const TEXT_EXTENSIONS = new Set([
  "txt",
  "csv",
  "json",
  "md",
  "markdown",
  "xml",
  "yaml",
  "yml",
  "log",
  "html",
  "htm",
  "ini",
])

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "msi",
  "sh",
  "ps1",
  "apk",
  "jar",
  "app",
])

function getFileExtension(fileName: string): string {
  const name = fileName.trim()
  if (!name.includes(".")) {
    return ""
  }

  return name.split(".").pop()?.toLowerCase() || ""
}

export function isBlockedFileExtension(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(getFileExtension(fileName))
}

export function isTextLikeFile(file: File): boolean {
  const mimeType = file.type.toLowerCase()

  if (TEXT_MIME_EXACT.has(mimeType)) {
    return true
  }

  if (TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true
  }

  return TEXT_EXTENSIONS.has(getFileExtension(file.name))
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B"
  }

  if (bytes < BYTES_IN_KB) {
    return `${bytes} B`
  }

  if (bytes < BYTES_IN_MB) {
    return `${(bytes / BYTES_IN_KB).toFixed(1)} KB`
  }

  return `${(bytes / BYTES_IN_MB).toFixed(1)} MB`
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>()
  const output: File[] = []

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(file)
  }

  return output
}

export function mergeFiles(current: File[], incoming: File[], maxCount = MAX_FORM_FILE_COUNT): File[] {
  return dedupeFiles([...current, ...incoming]).slice(0, Math.max(1, maxCount))
}

export function validateFiles(files: File[], maxCount = MAX_FORM_FILE_COUNT): string | null {
  if (files.length > maxCount) {
    return `Please upload up to ${maxCount} files.`
  }

  for (const file of files) {
    if (file.size > MAX_FORM_FILE_BYTES) {
      return `${file.name} is too large. Max file size is ${formatFileSize(MAX_FORM_FILE_BYTES)}.`
    }

    if (isBlockedFileExtension(file.name)) {
      return `${file.name} is not an allowed file type.`
    }
  }

  return null
}

export function appendFilesToFormData(formData: FormData, files: File[]): void {
  for (const file of files) {
    formData.append(FORM_UPLOAD_FIELD_NAME, file)
  }
}

export async function extractFileSnippet(file: File, limit = TEXT_FILE_SNIPPET_LIMIT): Promise<string> {
  if (!isTextLikeFile(file)) {
    return ""
  }

  const text = await file.text()
  return text.slice(0, limit)
}
