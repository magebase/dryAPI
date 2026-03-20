var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/tina-r2-media-store.ts
var tina_r2_media_store_exports = {};
__export(tina_r2_media_store_exports, {
  TinaR2MediaStore: () => TinaR2MediaStore,
  tinaR2MediaStore: () => tinaR2MediaStore
});
function isObjectRecord(value) {
  return typeof value === "object" && value !== null;
}
function extractString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function normalizeMediaPayload(value) {
  if (!isObjectRecord(value)) {
    throw new Error("Invalid Tina media payload.");
  }
  const raw = value.media && isObjectRecord(value.media) ? value.media : value;
  const id = extractString(raw.id);
  const src = extractString(raw.src);
  if (!id || !src) {
    throw new Error("Invalid Tina media payload.");
  }
  const filename = extractString(raw.filename) ?? src.split("/").pop() ?? id;
  const directory = extractString(raw.directory) ?? "";
  return {
    id,
    type: "file",
    filename,
    directory,
    src,
    thumbnails: isObjectRecord(raw.thumbnails) ? raw.thumbnails : void 0
  };
}
var api, TinaR2MediaStore, tinaR2MediaStore;
var init_tina_r2_media_store = __esm({
  "src/lib/tina-r2-media-store.ts"() {
    "use strict";
    api = {
      upload: "/admin/api/media/upload",
      list: "/admin/api/media/list",
      remove: "/admin/api/media/delete"
    };
    TinaR2MediaStore = class {
      constructor() {
        this.accept = "image/*,video/*";
      }
      async persist(media) {
        if (!(media.file instanceof File)) {
          throw new Error("Tina media persistence requires media.file to be a File instance.");
        }
        const body = new FormData();
        body.append("file", media.file);
        if (typeof media.directory === "string" && media.directory.trim().length > 0) {
          body.append("directory", media.directory);
        }
        const response = await fetch(api.upload, {
          method: "POST",
          body
        });
        if (!response.ok) {
          throw new Error("Failed to upload media to Cloudflare R2");
        }
        return normalizeMediaPayload(await response.json());
      }
      async list() {
        const response = await fetch(api.list);
        if (!response.ok) {
          throw new Error("Failed to list media from Cloudflare R2");
        }
        const payload = await response.json();
        const rawItems = Array.isArray(payload) ? payload : isObjectRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
        const items = rawItems.map((item) => normalizeMediaPayload(item));
        return {
          items,
          nextOffset: null
        };
      }
      async delete(media) {
        const response = await fetch(api.remove, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ id: media.id })
        });
        if (!response.ok) {
          throw new Error("Failed to delete media from Cloudflare R2");
        }
      }
      previewSrc(src) {
        const params = new URLSearchParams({
          url: src,
          w: "1200",
          q: "75"
        });
        return `/_next/image?${params.toString()}`;
      }
    };
    tinaR2MediaStore = new TinaR2MediaStore();
  }
});

// tina/config.js
import { LocalAuthProvider, defineConfig } from "tinacms";
var branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.CF_PAGES_BRANCH || "main";
var actionFields = [
  { name: "label", label: "Label", type: "string", required: true },
  { name: "href", label: "Href", type: "string", required: true },
  {
    name: "style",
    label: "Style",
    type: "string",
    options: ["solid", "outline", "ghost"],
    required: true
  }
];
var linkFields = [
  { name: "label", label: "Label", type: "string", required: true },
  { name: "href", label: "Href", type: "string", required: true }
];
var MAX_ROUTE_HERO_GALLERY_IMAGES = 6;
var MAX_ROUTE_SECTION_GALLERY_IMAGES = 6;
var MAX_SHOWCASE_CARD_GALLERY_IMAGES = 3;
var maxItemsValidation = (max, label) => (value) => {
  if (Array.isArray(value) && value.length > max) {
    return `${label} can include up to ${max} images.`;
  }
  return void 0;
};
var imageSlotFields = [
  { name: "id", label: "ID", type: "string", required: true },
  { name: "src", label: "Image", type: "image", required: true },
  { name: "alt", label: "Alt Text", type: "string" },
  { name: "caption", label: "Caption", type: "string", ui: { component: "textarea" } }
];
var pageElementFields = [
  { name: "id", type: "string", required: true },
  {
    name: "type",
    label: "Element Type",
    type: "string",
    options: ["heading", "paragraph", "link", "image", "custom"],
    required: true
  },
  { name: "text", label: "Text", type: "string", ui: { component: "textarea" } },
  { name: "href", label: "URL", type: "string" },
  { name: "src", label: "Image", type: "image" }
];
var contentApiUrlOverride = process.env.NEXT_PUBLIC_TINA_CONTENT_API_URL || "/admin/api/tina/gql";
var config_default = defineConfig({
  branch,
  // Keep Tina self-hosted and rely on Cloudflare Access for editor protection.
  clientId: null,
  token: null,
  contentApiUrlOverride,
  authProvider: new LocalAuthProvider(),
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    loadCustomStore: async () => {
      const store = await Promise.resolve().then(() => (init_tina_r2_media_store(), tina_r2_media_store_exports));
      return store.TinaR2MediaStore;
    }
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
          router: () => "/"
        },
        fields: [
          {
            name: "brand",
            type: "object",
            fields: [
              { name: "name", type: "string", required: true },
              { name: "mark", type: "string", required: true }
            ]
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
                description: "Contact form submissions are sent to this address."
              },
              {
                name: "quoteEmail",
                label: "Quote Email",
                type: "string",
                required: true,
                description: "Quote submissions are sent to this address."
              }
            ]
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
                fields: linkFields
              },
              {
                name: "quoteCta",
                type: "object",
                fields: actionFields
              }
            ]
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
                    required: true
                  }
                ]
              },
              {
                name: "columns",
                type: "object",
                list: true,
                fields: [
                  { name: "title", type: "string", required: true },
                  { name: "links", type: "object", list: true, fields: linkFields }
                ]
              },
              { name: "legalLinks", type: "object", list: true, fields: linkFields }
            ]
          },
          {
            name: "uiText",
            label: "UI Text Overrides",
            type: "object",
            list: true,
            description: "Optional key/value copy overrides used across page templates for visual editing.",
            fields: [
              { name: "key", type: "string", required: true },
              { name: "value", type: "string", ui: { component: "textarea" }, required: true }
            ],
            ui: {
              itemProps: (item) => ({
                label: item?.key || "ui-text"
              })
            }
          }
        ]
      },
      {
        label: "Home Page",
        name: "home",
        path: "content/site",
        format: "json",
        match: { include: "home" },
        ui: {
          allowedActions: { create: false, delete: false },
          router: () => "/"
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
              { name: "tertiaryAction", type: "object", fields: actionFields }
            ]
          },
          {
            name: "spotlightSection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true }
            ]
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
                  "sun"
                ],
                required: true
              }
            ]
          },
          {
            name: "capabilitySection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true }
            ]
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
                  "sun"
                ],
                required: true
              }
            ]
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
                    ui: { validate: maxItemsValidation(MAX_SHOWCASE_CARD_GALLERY_IMAGES, "Showcase gallery") }
                  },
                  { name: "href", type: "string", required: true },
                  { name: "tag", type: "string", required: true }
                ]
              }
            ]
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
                    ui: { validate: maxItemsValidation(MAX_SHOWCASE_CARD_GALLERY_IMAGES, "Showcase gallery") }
                  },
                  { name: "href", type: "string", required: true },
                  { name: "tag", type: "string", required: true }
                ]
              }
            ]
          },
          {
            name: "testimonialsSection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true },
              {
                name: "items",
                type: "object",
                list: true,
                fields: [
                  { name: "id", type: "string", required: true },
                  { name: "company", type: "string", required: true },
                  { name: "quote", type: "string", ui: { component: "textarea" }, required: true },
                  { name: "person", type: "string", required: true },
                  { name: "role", type: "string", required: true },
                  { name: "metric", type: "string" }
                ]
              }
            ]
          },
          {
            name: "trustedBySection",
            type: "object",
            fields: [
              { name: "visible", type: "boolean", required: true },
              { name: "kicker", type: "string", required: true },
              { name: "title", type: "string", required: true },
              {
                name: "logos",
                type: "object",
                list: true,
                fields: [
                  { name: "id", type: "string", required: true },
                  { name: "name", type: "string", required: true },
                  { name: "abbreviation", type: "string", required: true }
                ]
              }
            ]
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
              { name: "secondaryAction", type: "object", fields: actionFields }
            ]
          }
        ]
      },
      {
        label: "Blog Posts",
        name: "blogPosts",
        path: "content/blog",
        format: "json",
        ui: {
          router: ({ document }) => {
            if (!document?._sys?.filename) {
              return void 0;
            }
            return `/blog/${document._sys.filename}`;
          }
        },
        fields: [
          { name: "slug", type: "string", required: true },
          { name: "title", type: "string", required: true },
          { name: "excerpt", type: "string", ui: { component: "textarea" }, required: true },
          { name: "publishedAt", type: "string", required: true },
          {
            name: "author",
            type: "object",
            fields: [
              { name: "name", type: "string", required: true },
              { name: "role", type: "string", required: true },
              { name: "bio", type: "string", ui: { component: "textarea" } },
              { name: "avatar", type: "image" }
            ]
          },
          { name: "coverImage", type: "image", required: true },
          { name: "tags", type: "string", list: true, required: true },
          {
            name: "body",
            label: "Body (WYSIWYG)",
            type: "rich-text",
            required: true
          },
          { name: "seoTitle", type: "string", required: true },
          { name: "seoDescription", type: "string", ui: { component: "textarea" }, required: true },
          {
            name: "seoKeywords",
            type: "string",
            list: true,
            ui: {
              description: "Target keywords and topics for this article."
            }
          },
          {
            name: "canonicalPath",
            type: "string",
            ui: {
              description: "Canonical path such as /blog/my-article. Leave blank to auto-generate from slug."
            }
          },
          {
            name: "ogImage",
            type: "image",
            ui: {
              description: "Optional social preview image. Falls back to cover image."
            }
          },
          {
            name: "noindex",
            type: "boolean"
          }
        ]
      },
      {
        label: "Route Pages",
        name: "routePages",
        path: "content/pages",
        format: "json",
        ui: {
          router: ({ document }) => {
            if (typeof document?.slug === "string" && document.slug.startsWith("/")) {
              return document.slug;
            }
            if (!document?._sys?.filename) {
              return void 0;
            }
            return `/${document._sys.filename.replaceAll("__", "/")}`;
          }
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
                    label: `${item?.type || "element"}${item?.text ? `: ${item.text}` : ""}`
                  })
                }
              }
            ]
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
                ui: { validate: maxItemsValidation(MAX_ROUTE_HERO_GALLERY_IMAGES, "Hero gallery") }
              },
              { name: "actions", type: "object", list: true, fields: actionFields }
            ]
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
                ui: { validate: maxItemsValidation(MAX_ROUTE_SECTION_GALLERY_IMAGES, "Section gallery") }
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
                  { name: "ctaLabel", type: "string", required: true }
                ]
              }
            ]
          },
          {
            name: "contactPanel",
            type: "object",
            fields: [
              { name: "heading", type: "string" },
              { name: "body", type: "string", ui: { component: "textarea" } },
              { name: "responseTime", type: "string" }
            ]
          }
        ]
      }
    ]
  }
});
export {
  config_default as default
};
