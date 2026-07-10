const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "share",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

/**
 * Canonical URL normalization for dedup: lowercase scheme+host, strip
 * `www.`, strip tracking params, strip default ports, sort remaining query
 * params, strip trailing slash and fragment.
 */
export function canonicalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl.trim().toLowerCase();
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  const params = Array.from(url.searchParams.entries()).filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()));
  params.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);

  url.hash = "";
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  url.pathname = pathname;

  return url.toString();
}

const WIRE_PREFIXES = [/^breaking:\s*/i, /^update:\s*/i, /^watch:\s*/i];

/** Normalized title for exact-match dedup: lowercase, NFKC, strip punctuation/boilerplate. */
export function normalizeTitle(rawTitle: string): string {
  let title = rawTitle.normalize("NFKC").trim();
  for (const prefix of WIRE_PREFIXES) title = title.replace(prefix, "");
  title = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title;
}
