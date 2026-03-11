import { z } from "zod"

const requiredText = z.string().trim().min(1)

export const siteSettingsSchema = z.object({
  id: requiredText,
  companyName: requiredText,
  tagline: requiredText,
  phone: requiredText,
  email: z.string().email(),
  address: requiredText,
})

export const navigationSchema = z.object({
  id: requiredText,
  label: requiredText,
  href: requiredText,
  order: z.number().int().nonnegative(),
})

export const heroSchema = z.object({
  id: requiredText,
  eyebrow: requiredText,
  heading: requiredText,
  subheading: requiredText,
  primaryCtaLabel: requiredText,
  primaryCtaHref: requiredText,
  secondaryCtaLabel: requiredText,
  secondaryCtaHref: requiredText,
  heroImage: requiredText,
})

export const serviceSchema = z.object({
  id: requiredText,
  title: requiredText,
  description: requiredText,
  icon: requiredText,
})

export const projectSchema = z.object({
  id: requiredText,
  name: requiredText,
  sector: requiredText,
  summary: requiredText,
})

export const testimonialSchema = z.object({
  id: requiredText,
  quote: requiredText,
  author: requiredText,
  role: requiredText,
})

export const contactSchema = z.object({
  id: requiredText,
  heading: requiredText,
  description: requiredText,
  responseTime: requiredText,
})

export const cmsSchemaByResource = {
  siteSettings: siteSettingsSchema,
  navigation: navigationSchema,
  hero: heroSchema,
  services: serviceSchema,
  projects: projectSchema,
  testimonials: testimonialSchema,
  contact: contactSchema,
} as const

export const cmsDataSchema = z.object({
  siteSettings: z.array(siteSettingsSchema),
  navigation: z.array(navigationSchema),
  hero: z.array(heroSchema),
  services: z.array(serviceSchema),
  projects: z.array(projectSchema),
  testimonials: z.array(testimonialSchema),
  contact: z.array(contactSchema),
})

export type CmsData = z.infer<typeof cmsDataSchema>
export type CmsResourceName = keyof CmsData
export type CmsRecord<TResource extends CmsResourceName> = CmsData[TResource][number]
