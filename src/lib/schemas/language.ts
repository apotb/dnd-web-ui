import { z } from "zod";

export const languageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  script: z.string().nullable().optional(),
  is_standard: z.boolean().default(false),
  source: z.string().default("SRD"),
  description: z.string().default(""),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const newLanguageSchema = languageSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type Language = z.infer<typeof languageSchema>;
export type NewLanguage = z.infer<typeof newLanguageSchema>;
