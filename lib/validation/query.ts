import { z } from "zod";

export const queryTermSchema = z.object({
  termType: z.enum([
    "INCLUDE",
    "EXCLUDE",
    "PHRASE",
    "ALIAS",
    "DOMAIN_INCLUDE",
    "DOMAIN_EXCLUDE",
    "SOURCE_TYPE_FILTER",
    "LANGUAGE_FILTER",
    "GEO_FILTER",
  ]),
  value: z.string().min(1).max(300),
  language: z.string().default("any"),
  position: z.number().int().default(0),
});

export const createMonitoringQuerySchema = z.object({
  name: z.string().min(1).max(200),
  mode: z.enum(["VISUAL", "EXPERT"]),
  booleanExpression: z.string().max(4000).optional(),
  terms: z.array(queryTermSchema).default([]),
});

export const updateMonitoringQuerySchema = createMonitoringQuerySchema.partial();

export const testQuerySchema = z.object({
  expression: z.string().min(1).max(4000).optional(),
});
