/**
 * Builds a proposed Boolean expression from onboarding inputs. The user must
 * explicitly review and activate this before it drives any ingestion.
 */
export interface InitialQueryInputs {
  brandName: string;
  aliases: string[];
  handles: string[];
  geography: string[]; // e.g. ["Toronto", "Ontario", "Canada"]
  excludedMeanings: string[]; // e.g. ["astronomy"] for "North Star"
}

function quote(term: string): string {
  return term.includes(" ") || term.includes('"') ? `"${term.replace(/"/g, "")}"` : term;
}

export function generateInitialQuery(inputs: InitialQueryInputs): string {
  const brandTerms = [inputs.brandName, ...inputs.aliases, ...inputs.handles].filter(Boolean).map(quote);
  const brandClause = brandTerms.length > 1 ? `(${brandTerms.join(" OR ")})` : brandTerms[0] ?? "";

  const geoTerms = inputs.geography.filter(Boolean).map(quote);
  const geoClause = geoTerms.length > 0 ? ` AND (${geoTerms.join(" OR ")})` : "";

  const exclusionTerms = inputs.excludedMeanings.filter(Boolean);
  let exclusionClause = "";
  if (exclusionTerms.length > 0 && brandTerms.length > 0) {
    // Excludes coverage where the brand's name appears only in the sense of
    // its excluded (unrelated) meaning, e.g. NOT ("North Star" AND astronomy).
    const primaryTerm = quote(inputs.brandName);
    exclusionClause = ` NOT (${primaryTerm} AND (${exclusionTerms.map(quote).join(" OR ")}))`;
  }

  return `${brandClause}${geoClause}${exclusionClause}`.trim();
}
