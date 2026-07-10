import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  organizationName: z.string().min(1, "Organization name is required").max(200),
  locale: z.enum(["en", "fr"]).default("en"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
