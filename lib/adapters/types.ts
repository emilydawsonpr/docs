/**
 * Common interface every media-source adapter implements, so providers can
 * be added or removed without changing ingestion/normalization/dedup code.
 */

export type AuthStatus = "none" | "configured" | "missing";

export interface NormalizedMention {
  providerRecordId?: string;
  canonicalUrl: string;
  originalUrl: string;
  sourceName: string;
  sourceDomain: string;
  headline: string;
  excerpt?: string;
  bodyText?: string;
  author?: string;
  publishedAt: Date;
  language: string;
  country?: string;
  imageUrl?: string;
  rawProviderMetadata?: Record<string, unknown>;
}

export interface RawFetchResult {
  items: unknown[];
  fetchedAt: Date;
}

export interface AdapterQueryCapabilities {
  booleanOperators: boolean;
  domainFilter: boolean;
  dateRange: boolean;
}

export interface AdapterRateLimit {
  requestsPerMinute: number;
}

export interface AdapterAttribution {
  requiresAttribution: boolean;
  text?: string;
}

export interface AdapterConfig {
  [key: string]: unknown;
}

export interface SourceAdapter<TConfig extends AdapterConfig = AdapterConfig> {
  id: string;
  displayName: string;
  sourceTypeHint: string;
  tier: 1 | 2;
  authRequired: boolean;
  authStatus(config: TConfig): AuthStatus;
  supportedLanguages: string[];
  pollingFrequencyOptionsMins: number[];
  queryCapabilities: AdapterQueryCapabilities;
  rateLimit?: AdapterRateLimit;
  attribution: AdapterAttribution;
  /** Fetches raw provider data. `since` narrows to items published after this time when supported. */
  fetch(config: TConfig, since?: Date): Promise<RawFetchResult>;
  /** Converts raw provider items into the common normalized shape. */
  normalize(raw: RawFetchResult): NormalizedMention[];
}

export class AdapterNotImplementedError extends Error {
  constructor(adapterId: string) {
    super(`Adapter "${adapterId}" is not implemented in this environment (Tier 2 stub).`);
    this.name = "AdapterNotImplementedError";
  }
}

export class AdapterAuthMissingError extends Error {
  constructor(adapterId: string) {
    super(`Adapter "${adapterId}" requires credentials that are not configured.`);
    this.name = "AdapterAuthMissingError";
  }
}
