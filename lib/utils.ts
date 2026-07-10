import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Canadian-formatted date, e.g. "10 Jul 2026". Never invent a timezone: caller passes IANA zone. */
export function formatDateCA(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...options,
  }).format(d);
}

export function formatNumberCA(n: number): string {
  return new Intl.NumberFormat("en-CA").format(n);
}

export function formatPercentCA(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits)}%`;
}

export const CANADIAN_TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland Time" },
  { value: "America/Halifax", label: "Atlantic Time" },
  { value: "America/Toronto", label: "Eastern Time" },
  { value: "America/Winnipeg", label: "Central Time" },
  { value: "America/Edmonton", label: "Mountain Time" },
  { value: "America/Vancouver", label: "Pacific Time" },
] as const;

export const CANADIAN_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

export const FOCUS_CITIES = ["Toronto", "Vancouver", "Montréal", "Calgary", "Ottawa", "Halifax"] as const;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Whether `text` contains any of `names` as a whole word/phrase match rather
 * than a bare substring — avoids false positives like brand "Bell" matching
 * inside "rebellion". Word boundaries are Unicode-letter/number aware so
 * this also works for French accented names.
 */
export function textMentionsAnyName(text: string, names: string[]): boolean {
  const lower = text.toLowerCase();
  return names.some((name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const escaped = trimmed.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(lower);
  });
}
