export type ModelCategory = {
  slug: string
  label: string
  summary: string
}

export const modelCategories: ModelCategory[] = [
  {
    slug: "text-to-image",
    label: "Text To Image",
    summary: "Generate product visuals, ad creatives, and concept art from prompts.",
  },
  {
    slug: "text-to-speech",
    label: "Text To Speech",
    summary: "Render low-latency voices for support bots, narration, and agents.",
  },
  {
    slug: "video-to-text",
    label: "Video To Text",
    summary: "Transcribe recorded sessions, calls, and clips into searchable text.",
  },
  {
    slug: "image-to-text",
    label: "Image To Text",
    summary: "Extract OCR and structured insights from screenshots and documents.",
  },
  {
    slug: "image-to-video",
    label: "Image To Video",
    summary: "Animate still frames into short clips for rapid creative iteration.",
  },
  {
    slug: "text-to-video",
    label: "Text To Video",
    summary: "Generate storyboard-ready motion clips from natural language prompts.",
  },
  {
    slug: "text-to-embedding",
    label: "Text To Embedding",
    summary: "Create embeddings for semantic search, retrieval, and reranking.",
  },
  {
    slug: "image-to-image",
    label: "Image To Image",
    summary: "Transform reference images with style transfer and guided edits.",
  },
  {
    slug: "text-to-music",
    label: "Text To Music",
    summary: "Compose royalty-safe tracks and loops from creative direction prompts.",
  },
  {
    slug: "background-removal",
    label: "Background Removal",
    summary: "Cut out subjects for e-commerce listings and creative production.",
  },
]

export function findModelCategory(slug: string) {
  return modelCategories.find((category) => category.slug === slug)
}
