import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  timezone: z.string().default("America/Toronto"),
  languages: z.array(z.string()).default(["en"]),
  regions: z.array(z.string()).default(["CA"]),
  focusCities: z.array(z.string()).default([]),
  crisisTerms: z.array(z.string()).default([]),
  isDemo: z.boolean().default(false),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
