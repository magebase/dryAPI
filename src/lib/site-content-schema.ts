import { z } from "zod"

const requiredText = z.string().trim().min(1)
const visibleToggleSchema = z.boolean().default(true)
const MAX_ROUTE_HERO_GALLERY_IMAGES = 6
const MAX_ROUTE_SECTION_GALLERY_IMAGES = 6
const MAX_SHOWCASE_CARD_GALLERY_IMAGES = 3

export const linkSchema = z.object({
  label: requiredText,
  href: requiredText,
})

export const socialLinkSchema = z.object({
  label: requiredText,
  href: requiredText,
  icon: z.enum(["facebook", "instagram", "linkedin", "youtube"]),
})

export const ctaSchema = z.object({
  label: requiredText,
  href: requiredText,
  style: z.enum(["solid", "outline", "ghost"]).default("solid"),
})

export const iconCardSchema = z.object({
  id: requiredText,
  visible: visibleToggleSchema,
  title: requiredText,
  description: requiredText,
  icon: z.enum([
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
  ]),
})

export const showcaseCardSchema = z.object({
  id: requiredText,
  visible: visibleToggleSchema,
  title: requiredText,
  summary: requiredText,
  image: requiredText,
  galleryImages: z
    .array(
      z.object({
        id: requiredText,
        src: requiredText,
        alt: z.string().trim().optional(),
        caption: z.string().trim().optional(),
      })
    )
    .max(MAX_SHOWCASE_CARD_GALLERY_IMAGES, `Showcase cards support up to ${MAX_SHOWCASE_CARD_GALLERY_IMAGES} gallery images.`)
    .optional(),
  href: requiredText,
  tag: requiredText,
})

export const testimonialCardSchema = z.object({
  id: requiredText,
  company: requiredText,
  quote: requiredText,
  person: requiredText,
  role: requiredText,
  metric: z.string().trim().optional(),
})

export const trustedLogoSchema = z.object({
  id: requiredText,
  name: requiredText,
  abbreviation: requiredText,
})

export const siteConfigSchema = z.object({
  brand: z.object({
    name: requiredText,
    mark: requiredText,
  }),
  contact: z.object({
    contactEmail: z
      .string()
      .trim()
      .email("Contact email must be a valid email address."),
    quoteEmail: z
      .string()
      .trim()
      .email("Quote email must be a valid email address."),
  }),
  announcement: requiredText,
  header: z.object({
    primaryLinks: z.array(linkSchema),
    phone: z.object({
      label: requiredText,
      href: requiredText,
    }),
    quoteCta: ctaSchema,
  }),
  footer: z.object({
    companyText: requiredText,
    contactLinks: z.array(linkSchema),
    socialLinks: z.array(socialLinkSchema),
    columns: z.array(
      z.object({
        title: requiredText,
        links: z.array(linkSchema),
      })
    ),
    legalLinks: z.array(linkSchema),
  }),
})

export const homeContentSchema = z.object({
  seoTitle: requiredText,
  seoDescription: requiredText,
  hero: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    heading: requiredText,
    subheading: requiredText,
    backgroundImage: requiredText,
    primaryAction: ctaSchema,
    secondaryAction: ctaSchema,
    tertiaryAction: ctaSchema,
  }),
  spotlightSection: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    title: requiredText,
  }),
  spotlightCards: z.array(iconCardSchema).min(3),
  capabilitySection: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    title: requiredText,
  }),
  capabilityCards: z.array(iconCardSchema).min(6),
  projectShowcase: z.object({
    visible: visibleToggleSchema,
    title: requiredText,
    ctaLabel: requiredText,
    ctaHref: requiredText,
    items: z.array(showcaseCardSchema).min(3),
  }),
  resourceShowcase: z.object({
    visible: visibleToggleSchema,
    title: requiredText,
    ctaLabel: requiredText,
    ctaHref: requiredText,
    items: z.array(showcaseCardSchema).min(3),
  }),
  testimonialsSection: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    title: requiredText,
    items: z.array(testimonialCardSchema).min(4),
  }),
  trustedBySection: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    title: requiredText,
    logos: z.array(trustedLogoSchema).min(6),
  }),
  contactPanel: z.object({
    visible: visibleToggleSchema,
    kicker: requiredText,
    heading: requiredText,
    body: requiredText,
    primaryAction: ctaSchema,
    secondaryAction: ctaSchema,
  }),
})

export const routeCardSchema = z.object({
  id: requiredText,
  title: requiredText,
  description: requiredText,
  image: z.string().trim().optional(),
  href: requiredText,
  ctaLabel: requiredText,
})

const imageSlotSchema = z.object({
  id: requiredText,
  src: requiredText,
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
})

export const routePageElementSchema = z
  .object({
    id: requiredText,
    type: z.enum(["heading", "paragraph", "link", "image", "custom"]),
    text: z.string().optional(),
    href: z.string().optional(),
    src: z.string().optional(),
  })
  .superRefine((element, ctx) => {
    if (element.type === "image" && !element.src?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["src"],
        message: "Image elements require an image source.",
      })
    }

    if (element.type === "link") {
      if (!element.href?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["href"],
          message: "Link elements require a URL.",
        })
      }

      if (!element.text?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["text"],
          message: "Link elements require link text.",
        })
      }
    }

    if ((element.type === "heading" || element.type === "paragraph") && !element.text?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: `${element.type} elements require text.`,
      })
    }
  })

export const routeSectionSchema = z.object({
  id: requiredText,
  title: requiredText,
  body: requiredText,
  galleryImages: z
    .array(imageSlotSchema)
    .max(MAX_ROUTE_SECTION_GALLERY_IMAGES, `Sections support up to ${MAX_ROUTE_SECTION_GALLERY_IMAGES} gallery images.`)
    .optional(),
  cards: z.array(routeCardSchema),
})

export const routePageSchema = z.object({
  slug: requiredText,
  navLabel: requiredText,
  seoTitle: requiredText,
  seoDescription: requiredText,
  pageContent: z
    .object({
      elements: z.array(routePageElementSchema),
    })
    .optional(),
  hero: z.object({
    kicker: requiredText,
    heading: requiredText,
    body: requiredText,
    image: requiredText,
    galleryImages: z
      .array(imageSlotSchema)
      .max(MAX_ROUTE_HERO_GALLERY_IMAGES, `Hero sections support up to ${MAX_ROUTE_HERO_GALLERY_IMAGES} gallery images.`)
      .optional(),
    actions: z.array(ctaSchema),
  }),
  sections: z.array(routeSectionSchema),
  contactPanel: z
    .object({
      heading: requiredText,
      body: requiredText,
      responseTime: requiredText,
    })
    .optional(),
})

export const blogSectionSchema = z.object({
  id: requiredText,
  heading: requiredText,
  body: requiredText,
})

export const blogPostSchema = z.object({
  slug: requiredText,
  title: requiredText,
  excerpt: requiredText,
  seoTitle: requiredText,
  seoDescription: requiredText,
  publishedAt: requiredText,
  author: z.object({
    name: requiredText,
    role: requiredText,
  }),
  coverImage: requiredText,
  tags: z.array(requiredText).min(1),
  sections: z.array(blogSectionSchema).min(1),
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
export type HomeContent = z.infer<typeof homeContentSchema>
export type RoutePage = z.infer<typeof routePageSchema>
export type BlogPost = z.infer<typeof blogPostSchema>
