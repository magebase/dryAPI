import { defineConfig } from "tinacms"

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.CF_PAGES_BRANCH ||
  "main"

const actionFields = [
  { name: "label", label: "Label", type: "string", required: true },
  { name: "href", label: "Href", type: "string", required: true },
  {
    name: "style",
    label: "Style",
    type: "string",
    options: ["solid", "outline", "ghost"],
    required: true,
  },
]

const linkFields = [
  { name: "label", label: "Label", type: "string", required: true },
  { name: "href", label: "Href", type: "string", required: true },
]

const MAX_ROUTE_HERO_GALLERY_IMAGES = 6
const MAX_ROUTE_SECTION_GALLERY_IMAGES = 6
const MAX_SHOWCASE_CARD_GALLERY_IMAGES = 3

const maxItemsValidation = (max, label) => (value) => {
  if (Array.isArray(value) && value.length > max) {
    return `${label} can include up to ${max} images.`
  }

  return undefined
}

const imageSlotFields = [
  { name: "id", label: "ID", type: "string", required: true },
  { name: "src", label: "Image", type: "image", required: true },
  { name: "alt", label: "Alt Text", type: "string" },
  { name: "caption", label: "Caption", type: "string", ui: { component: "textarea" } },
]

const pageElementFields = [
  { name: "id", type: "string", required: true },
  {
    name: "type",
    label: "Element Type",
    type: "string",
    options: ["heading", "paragraph", "link", "image", "custom"],
    required: true,
  },
  { name: "text", label: "Text", type: "string", ui: { component: "textarea" } },
  { name: "href", label: "URL", type: "string" },
  { name: "src", label: "Image", type: "image" },
]

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,
  contentApiUrlOverride: process.env.NEXT_PUBLIC_TINA_CONTENT_API_URL || "http://localhost:4001/graphql",
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    loadCustomStore: async () => {
      const store = await import("../src/lib/tina-r2-media-store")
      return store.TinaR2MediaStore
    },
  },
  schema: {
    collections: [
      {
        label: "Site Config",
        name: "siteConfig",
        path: "content/site",
        format: "json",
        match: { include: "site-config" },
        ui: {
          allowedActions: { create: false, delete: false },
          router: () => "/",
        },
        fields: [
          {
            name: "brand",
            type: "object",
            fields: [
              { name: "name", type: "string", required: true },
              { name: "mark", type: "string", required: true },
            ],
          },
          {
            name: "contact",
            type: "object",
            fields: [
              {
                name: "contactEmail",
                label: "Contact Email",
                type: "string",
                required: true,
                description: "Contact form submissions are sent to this address.",
              },
              {
                name: "quoteEmail",
                label: "Quote Email",
                type: "string",
                required: true,
                description: "Quote submissions are sent to this address.",
              },
            ],
          },
          { name: "announcement", type: "string", required: true },
          {
            name: "header",
            type: "object",
            fields: [
              { name: "primaryLinks", type: "object", list: true, fields: linkFields },
              {
                name: "phone",
                type: "object",
                fields: linkFields,
              },
              {
                name: "quoteCta",
                type: "object",
                fields: actionFields,
              },
            ],
          },
          {
            name: "footer",
            type: "object",
            fields: [
              { name: "companyText", type: "string", ui: { component: "textarea" }, required: true },
              { name: "contactLinks", type: "object", list: true, fields: linkFields },
              {
                name: "socialLinks",
                type: "object",
                list: true,
                fields: [
                  ...linkFields,
                  {
                    name: "icon",
                    type: "string",
                    options: ["facebook", "instagram", "linkedin", "youtube"],
                    required: true,
                  },
                ],
              },
              {
                name: "columns",
                type: "object",
                list: true,
                fields: [
                  { name: "title", type: "string", required: true },
                  { name: "links", type: "object", list: true, fields: linkFields },
                ],
              },
              { name: "legalLinks", type: "object", list: true, fields: linkFields },
            ],
          },
        ],
      },
      {
        label: "Home Page",
        name: "home",
        path: "content/site",
        format: "json",
        match: { include: "home" },
        ui: {
          allowedActions: { create: false, delete: false },
          router: () => "/",
        },
        fields: [
          { name: "seoTitle", type: "string", required: true },
          { name: "seoDescription", type: "string", required: true },
          {
            name: "hero",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "heading", type: "string", required: true },
              { name: "subheading", type: "string", ui: { component: "textarea" }, required: true },
              { name: "backgroundImage", type: "image", required: true },
              { name: "primaryAction", type: "object", fields: actionFields },
              { name: "secondaryAction", type: "object", fields: actionFields },
              { name: "tertiaryAction", type: "object", fields: actionFields },
            ],
          },
          {
            name: "spotlightSection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true },
            ],
          },
          {
            name: "spotlightCards",
            type: "object",
            list: true,
            fields: [
              { name: "id", type: "string", required: true },
              { name: "visible", type: "boolean", required: true },
              { name: "title", type: "string", required: true },
              { name: "description", type: "string", ui: { component: "textarea" }, required: true },
              {
                name: "icon",
                type: "string",
                options: [
                  "wrench",
                  "truck",
                  "shield",
                  "settings",
                  "bolt",
                  "plug",
                  "factory",
                  "hard-hat",
                  "radio",
                  "sun",
                ],
                required: true,
              },
            ],
          },
          {
            name: "capabilitySection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true },
            ],
          },
          {
            name: "capabilityCards",
            type: "object",
            list: true,
            fields: [
              { name: "id", type: "string", required: true },
              { name: "visible", type: "boolean", required: true },
              { name: "title", type: "string", required: true },
              { name: "description", type: "string", ui: { component: "textarea" }, required: true },
              {
                name: "icon",
                type: "string",
                options: [
                  "wrench",
                  "truck",
                  "shield",
                  "settings",
                  "bolt",
                  "plug",
                  "factory",
                  "hard-hat",
                  "radio",
                  "sun",
                ],
                required: true,
              },
            ],
          },
          {
            name: "projectShowcase",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "title", type: "string", required: true },
              { name: "ctaLabel", type: "string", required: true },
              { name: "ctaHref", type: "string", required: true },
              {
                name: "items",
                type: "object",
                list: true,
                fields: [
                  { name: "id", type: "string", required: true },
                  { name: "visible", type: "boolean", required: true },
                  { name: "title", type: "string", required: true },
                  { name: "summary", type: "string", ui: { component: "textarea" }, required: true },
                  { name: "image", type: "image", required: true },
                  {
                    name: "galleryImages",
                    type: "object",
                    list: true,
                    fields: imageSlotFields,
                    ui: { validate: maxItemsValidation(MAX_SHOWCASE_CARD_GALLERY_IMAGES, "Showcase gallery") },
                  },
                  { name: "href", type: "string", required: true },
                  { name: "tag", type: "string", required: true },
                ],
              },
            ],
          },
          {
            name: "resourceShowcase",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "title", type: "string", required: true },
              { name: "ctaLabel", type: "string", required: true },
              { name: "ctaHref", type: "string", required: true },
              {
                name: "items",
                type: "object",
                list: true,
                fields: [
                  { name: "id", type: "string", required: true },
                  { name: "visible", type: "boolean", required: true },
                  { name: "title", type: "string", required: true },
                  { name: "summary", type: "string", ui: { component: "textarea" }, required: true },
                  { name: "image", type: "image", required: true },
                  {
                    name: "galleryImages",
                    type: "object",
                    list: true,
                    fields: imageSlotFields,
                    ui: { validate: maxItemsValidation(MAX_SHOWCASE_CARD_GALLERY_IMAGES, "Showcase gallery") },
                  },
                  { name: "href", type: "string", required: true },
                  { name: "tag", type: "string", required: true },
                ],
              },
            ],
          },
          {
            name: "contactPanel",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "heading", type: "string", required: true },
              { name: "body", type: "string", ui: { component: "textarea" }, required: true },
              { name: "primaryAction", type: "object", fields: actionFields },
              { name: "secondaryAction", type: "object", fields: actionFields },
            ],
          },
        ],
      },
      {
        label: "Blog Posts",
        name: "blogPosts",
        path: "content/blog",
        format: "json",
        ui: {
          router: ({ document }) => {
            if (!document?._sys?.filename) {
              return undefined
            }

            return `/blog/${document._sys.filename}`
          },
        },
        fields: [
          { name: "slug", type: "string", required: true },
          { name: "title", type: "string", required: true },
          { name: "excerpt", type: "string", ui: { component: "textarea" }, required: true },
          { name: "seoTitle", type: "string", required: true },
          { name: "seoDescription", type: "string", ui: { component: "textarea" }, required: true },
          { name: "publishedAt", type: "string", required: true },
          {
            name: "author",
            type: "object",
            fields: [
              { name: "name", type: "string", required: true },
              { name: "role", type: "string", required: true },
            ],
          },
          { name: "coverImage", type: "image", required: true },
          { name: "tags", type: "string", list: true, required: true },
          {
            name: "sections",
            type: "object",
            list: true,
            fields: [
              { name: "id", type: "string", required: true },
              { name: "heading", type: "string", required: true },
              { name: "body", type: "string", ui: { component: "textarea" }, required: true },
            ],
          },
        ],
      },
      {
        label: "Route Pages",
        name: "routePages",
        path: "content/pages",
        format: "json",
        ui: {
          router: ({ document }) => {
            if (typeof document?.slug === "string" && document.slug.startsWith("/")) {
              return document.slug
            }

            if (!document?._sys?.filename) {
              return undefined
            }

            return `/${document._sys.filename.replaceAll("__", "/")}`
          },
        },
        fields: [
          { name: "slug", type: "string", required: true },
          { name: "navLabel", type: "string", required: true },
          { name: "seoTitle", type: "string", required: true },
          { name: "seoDescription", type: "string", required: true },
          {
            name: "pageContent",
            label: "Page Content",
            type: "object",
            fields: [
              {
                name: "elements",
                label: "Page Elements",
                type: "object",
                list: true,
                fields: pageElementFields,
                ui: {
                  itemProps: (item) => ({
                    label: `${item?.type || "element"}${item?.text ? `: ${item.text}` : ""}`,
                  }),
                },
              },
            ],
          },
          {
            name: "hero",
            type: "object",
            fields: [
              { name: "kicker", type: "string", required: true },
              { name: "heading", type: "string", required: true },
              { name: "body", type: "string", ui: { component: "textarea" }, required: true },
              { name: "image", type: "image", required: true },
              {
                name: "galleryImages",
                type: "object",
                list: true,
                fields: imageSlotFields,
                ui: { validate: maxItemsValidation(MAX_ROUTE_HERO_GALLERY_IMAGES, "Hero gallery") },
              },
              { name: "actions", type: "object", list: true, fields: actionFields },
            ],
          },
          {
            name: "sections",
            type: "object",
            list: true,
            fields: [
              { name: "id", type: "string", required: true },
              { name: "title", type: "string", required: true },
              { name: "body", type: "string", ui: { component: "textarea" }, required: true },
              {
                name: "galleryImages",
                type: "object",
                list: true,
                fields: imageSlotFields,
                ui: { validate: maxItemsValidation(MAX_ROUTE_SECTION_GALLERY_IMAGES, "Section gallery") },
              },
              {
                name: "cards",
                type: "object",
                list: true,
                fields: [
                  { name: "id", type: "string", required: true },
                  { name: "title", type: "string", required: true },
                  { name: "description", type: "string", ui: { component: "textarea" }, required: true },
                  { name: "image", type: "image" },
                  { name: "href", type: "string", required: true },
                  { name: "ctaLabel", type: "string", required: true },
                ],
              },
            ],
          },
          {
            name: "contactPanel",
            type: "object",
            fields: [
              { name: "heading", type: "string" },
              { name: "body", type: "string", ui: { component: "textarea" } },
              { name: "responseTime", type: "string" },
            ],
          },
        ],
      },
    ],
  },
})
