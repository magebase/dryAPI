import { z } from "zod"

const MAX_UPLOAD_BYTES = 10_000_000

export const uploadPresignRequestSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})

export type UploadPresignRequest = z.infer<typeof uploadPresignRequestSchema>
