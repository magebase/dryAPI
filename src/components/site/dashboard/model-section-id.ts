export function buildModelTaskSectionId(slug: string): string {
  const normalizedSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `models-task-${normalizedSlug || "unknown"}`
}
