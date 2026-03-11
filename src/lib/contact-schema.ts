import { z } from "zod"

export const contactSubmissionSchema = z.object({
  submissionType: z.enum(["contact", "quote"]).optional().default("contact"),
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  company: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  enquiryType: z.string().trim().optional().default(""),
  preferredContactMethod: z.string().trim().optional().default(""),
  message: z.string().trim().min(10, "Please share more project details."),
})

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>
