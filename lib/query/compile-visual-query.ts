export interface VisualTermInput {
  termType: "INCLUDE" | "EXCLUDE" | "PHRASE" | "ALIAS" | "DOMAIN_INCLUDE" | "DOMAIN_EXCLUDE" | "SOURCE_TYPE_FILTER" | "LANGUAGE_FILTER" | "GEO_FILTER";
  value: string;
}

function quote(term: string): string {
  return term.includes(" ") || term.includes('"') ? `"${term.replace(/"/g, "")}"` : term;
}

/**
 * Compiles visual-mode QueryTerm rows into an expert-mode Boolean expression
 * string. Only content-matching term types (INCLUDE / ALIAS / PHRASE /
 * EXCLUDE) affect the text-matching expression — DOMAIN_INCLUDE,
 * DOMAIN_EXCLUDE, SOURCE_TYPE_FILTER, LANGUAGE_FILTER, and GEO_FILTER are
 * structured filters applied separately at the source-connection / coverage
 * feed layer, not encoded into the free-text Boolean grammar.
 */
export function compileVisualQuery(terms: VisualTermInput[]): string {
  const includeTerms = terms
    .filter((t) => t.termType === "INCLUDE" || t.termType === "ALIAS")
    .map((t) => quote(t.value));
  const phraseTerms = terms.filter((t) => t.termType === "PHRASE").map((t) => `"${t.value.replace(/"/g, "")}"`);
  const excludeTerms = terms.filter((t) => t.termType === "EXCLUDE").map((t) => quote(t.value));

  const includeAll = [...includeTerms, ...phraseTerms].filter(Boolean);
  let expr = includeAll.length > 1 ? `(${includeAll.join(" OR ")})` : includeAll[0] ?? "";

  if (excludeTerms.length > 0 && expr) {
    expr += ` NOT (${excludeTerms.join(" OR ")})`;
  }

  return expr.trim();
}
