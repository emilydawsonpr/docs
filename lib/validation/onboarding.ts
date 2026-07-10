import { z } from "zod";

export const onboardingSchema = z.object({
  projectName: z.string().min(1).max(200),
  website: z.string().max(300).optional().or(z.literal("")),
  brandName: z.string().min(1).max(200),
  aliases: z.array(z.string()).default([]),
  socialHandles: z.array(z.string()).default([]),
  executives: z.array(z.string()).default([]),
  products: z.array(z.string()).default([]),
  campaigns: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  geography: z.array(z.string()).default(["Canada"]),
  languages: z.array(z.enum(["en", "fr"])).default(["en"]),
  priorityPublications: z.array(z.string()).default([]),
  excludedMeanings: z.array(z.string()).default([]),
  keyMessages: z.array(z.string()).default([]),
  crisisTerms: z.array(z.string()).default([]),
  alertRecipients: z.array(z.string().email()).default([]),
  timezone: z.string().default("America/Toronto"),
  focusCities: z.array(z.string()).default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
