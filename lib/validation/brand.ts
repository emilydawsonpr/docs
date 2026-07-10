import { z } from "zod";

export const updateBrandSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  aliases: z.array(z.string()).optional(),
  websites: z.array(z.string()).optional(),
  handles: z.array(z.string()).optional(),
  executives: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  campaigns: z.array(z.string()).optional(),
});

export const createCompetitorSchema = z.object({
  name: z.string().min(1).max(200),
  aliases: z.array(z.string()).default([]),
});

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
