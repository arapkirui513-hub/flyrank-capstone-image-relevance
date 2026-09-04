import { z } from "zod";

export const visionMetadataSchema = z.object({
  subject: z.string(),
  category: z.string(),
  attributes: z.array(z.string()),
  caption: z.string(),
  confidence: z.number().min(0).max(1)
});

export const guardResultSchema = z.object({
  decision: z.enum([
    "accepted",
    "rejected",
    "no_confident_match"
  ]),
  similarityScore: z.number().nullable(),
  reason: z.string().nullable()
});