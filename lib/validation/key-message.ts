import { z } from "zod";

export const createKeyMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  aliases: z.array(z.string()).default([]),
});

export const updateKeyMessageSchema = createKeyMessageSchema.partial();

export type CreateKeyMessageInput = z.infer<typeof createKeyMessageSchema>;
export type UpdateKeyMessageInput = z.infer<typeof updateKeyMessageSchema>;
