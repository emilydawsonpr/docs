/**
 * Expert-mode Boolean query grammar for SignalWatch monitoring queries.
 *
 * Supports: AND / OR / NOT (case-insensitive keywords), "exact phrases",
 * (parentheses for grouping), trailing wildcards (word*), and bare terms
 * (including @handles, hyphenated/accented words for French support).
 *
 * Precedence (highest to lowest): NOT, AND, OR. Parentheses override.
 *
 * Example: ("Northstar Coffee" OR "North Star Coffee" OR @northstarcoffee)
 *          AND (Toronto OR Ontario OR Canada)
 *          NOT ("North Star" AND astronomy)
 */

export type QueryNode =
  | { type: "AND"; children: QueryNode[] }
  | { type: "OR"; children: QueryNode[] }
  | { type: "NOT"; child: QueryNode }
  | { type: "PHRASE"; value: string }
  | { type: "TERM"; value: string; wildcard: boolean };

export class QueryParseError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = "QueryParseError";
    this.position = position;
  }
}

type Token =
  | { kind: "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN"; pos: number }
  | { kind: "PHRASE"; value: string; pos: number }
  | { kind: "TERM"; value: string; wildcard: boolean; pos: number };

const KEYWORDS = new Set(["AND", "OR", "NOT"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "LPAREN", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "RPAREN", pos: i });
      i++;
      continue;
    }

    if (ch === '"' || ch === "“" || ch === "”") {
      const start = i;
      i++;
      let value = "";
      while (i < n && input[i] !== '"' && input[i] !== "”") {
        value += input[i];
        i++;
      }
      if (i >= n) {
        throw new QueryParseError("Unterminated quoted phrase", start);
      }
      i++; // closing quote
      tokens.push({ kind: "PHRASE", value: value.trim(), pos: start });
      continue;
    }

    // Bare term: letters/digits/accents/@/./'/-/* , stop at whitespace or parens/quotes.
    if (/[^\s()"“”]/.test(ch)) {
      const start = i;
      let value = "";
      while (i < n && /[^\s()"“”]/.test(input[i])) {
        value += input[i];
        i++;
      }
      const upper = value.toUpperCase();
      if (KEYWORDS.has(upper)) {
        tokens.push({ kind: upper as "AND" | "OR" | "NOT", pos: start });
      } else {
        const wildcard = value.endsWith("*");
        tokens.push({
          kind: "TERM",
          value: wildcard ? value.slice(0, -1) : value,
          wildcard,
          pos: start,
        });
      }
      continue;
    }

    throw new QueryParseError(`Unexpected character '${ch}'`, i);
  }

  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): QueryNode {
    if (this.tokens.length === 0) {
      throw new QueryParseError("Query is empty", 0);
    }
    const node = this.parseOr();
    if (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      throw new QueryParseError(`Unexpected token near position ${tok.pos}`, tok.pos);
    }
    return node;
  }

  private parseOr(): QueryNode {
    const children = [this.parseAnd()];
    while (this.peek()?.kind === "OR") {
      this.next();
      children.push(this.parseAnd());
    }
    return children.length === 1 ? children[0] : { type: "OR", children };
  }

  private parseAnd(): QueryNode {
    const children = [this.parseNot()];
    // Juxtaposition implies AND (e.g. `(...) AND (...) NOT (...)` — the final
    // NOT clause has no explicit AND before it, which is standard in
    // real-world Boolean query syntax), so we keep consuming NotExprs as
    // long as one can start here, consuming an explicit AND token if present.
    while (this.canStartNotExpr()) {
      if (this.peek()?.kind === "AND") this.next();
      children.push(this.parseNot());
    }
    return children.length === 1 ? children[0] : { type: "AND", children };
  }

  private canStartNotExpr(): boolean {
    const tok = this.peek();
    if (!tok) return false;
    return tok.kind === "AND" || tok.kind === "NOT" || tok.kind === "LPAREN" || tok.kind === "PHRASE" || tok.kind === "TERM";
  }

  private parseNot(): QueryNode {
    if (this.peek()?.kind === "NOT") {
      this.next();
      return { type: "NOT", child: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const tok = this.peek();
    if (!tok) {
      throw new QueryParseError("Unexpected end of query", this.tokens.at(-1)?.pos ?? 0);
    }

    if (tok.kind === "LPAREN") {
      this.next();
      const node = this.parseOr();
      const closing = this.next();
      if (!closing || closing.kind !== "RPAREN") {
        throw new QueryParseError("Missing closing parenthesis", tok.pos);
      }
      return node;
    }

    if (tok.kind === "PHRASE") {
      this.next();
      if (!tok.value) throw new QueryParseError("Empty quoted phrase", tok.pos);
      return { type: "PHRASE", value: tok.value };
    }

    if (tok.kind === "TERM") {
      this.next();
      return { type: "TERM", value: tok.value, wildcard: tok.wildcard };
    }

    throw new QueryParseError(`Unexpected token near position ${tok.pos}`, tok.pos);
  }
}

export function parseQuery(input: string): QueryNode {
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}

// ---------------------------------------------------------------------------
// Evaluation against plain text (used both by "test against recent results"
// and, as a deterministic pre-check, by the AI analysis pipeline).
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function termToRegex(value: string, wildcard: boolean): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = wildcard ? `\\b${escaped}` : `\\b${escaped}\\b`;
  return new RegExp(pattern, "i");
}

export function evaluateQuery(node: QueryNode, text: string): boolean {
  const normalized = normalize(text);
  switch (node.type) {
    case "AND":
      return node.children.every((c) => evaluateQuery(c, normalized));
    case "OR":
      return node.children.some((c) => evaluateQuery(c, normalized));
    case "NOT":
      return !evaluateQuery(node.child, normalized);
    case "PHRASE":
      return normalized.includes(normalize(node.value));
    case "TERM":
      return termToRegex(node.value, node.wildcard).test(normalized);
  }
}

/** Collects every literal term/phrase value referenced anywhere in the query. */
export function collectTerms(node: QueryNode): string[] {
  switch (node.type) {
    case "AND":
    case "OR":
      return node.children.flatMap(collectTerms);
    case "NOT":
      return collectTerms(node.child);
    case "PHRASE":
    case "TERM":
      return [node.value];
  }
}

// ---------------------------------------------------------------------------
// Query validator
// ---------------------------------------------------------------------------

export interface QueryValidationResult {
  valid: boolean;
  ast: QueryNode | null;
  errors: string[];
  warnings: string[];
}

const COMMON_STOPWORDS = new Set([
  "news",
  "canada",
  "canadian",
  "the",
  "and",
  "company",
  "inc",
  "corp",
  "group",
  "team",
  "update",
  "today",
]);

export function validateQuery(
  input: string,
  context?: { brandAliases?: string[] }
): QueryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let ast: QueryNode | null = null;

  try {
    ast = parseQuery(input);
  } catch (e) {
    if (e instanceof QueryParseError) {
      errors.push(`Syntax error at position ${e.position}: ${e.message}`);
    } else {
      errors.push("Unable to parse query.");
    }
    return { valid: false, ast: null, errors, warnings };
  }

  const terms = collectTerms(ast);

  // Overly broad / ambiguous bare terms (not part of a quoted phrase, short,
  // or a common stopword) flagged as potential false-positive sources.
  for (const term of terms) {
    const bare = !input.includes(`"${term}"`);
    if (bare && (term.length <= 3 || COMMON_STOPWORDS.has(term.toLowerCase()))) {
      warnings.push(
        `The term "${term}" is short or very common and may produce false-positive matches. Consider quoting a more specific phrase or pairing it with an AND clause.`
      );
    }
  }

  // Ambiguous company name heuristic: a single bare (non-phrase) one-word
  // term with no geographic/AND qualifier anywhere in the query.
  const hasAnd = JSON.stringify(ast).includes('"AND"');
  const bareShortTerms = terms.filter((t) => !input.includes(`"${t}"`) && t.split(" ").length === 1);
  if (bareShortTerms.length > 0 && !hasAnd) {
    warnings.push(
      "This query has no AND-qualifier (e.g. a geography or product term) narrowing a bare brand name — it may be ambiguous with unrelated entities of the same name."
    );
  }

  // Missing brand variations: known aliases not referenced anywhere in the query.
  if (context?.brandAliases?.length) {
    const lowerInput = input.toLowerCase();
    const missing = context.brandAliases.filter((alias) => !lowerInput.includes(alias.toLowerCase()));
    if (missing.length > 0) {
      warnings.push(`Known brand aliases not included in this query: ${missing.join(", ")}.`);
    }
  }

  // Potentially expensive query: many top-level OR branches with no narrowing AND.
  function countOrBranches(node: QueryNode): number {
    if (node.type === "OR") return node.children.reduce((sum, c) => sum + countOrBranches(c), 0);
    return 1;
  }
  const orBranches = ast.type === "OR" ? countOrBranches(ast) : 0;
  if (orBranches > 8) {
    warnings.push(
      `This query has ${orBranches} OR-ed alternatives at the top level, which may match a very large, costly volume of coverage. Consider narrowing with an AND clause.`
    );
  }

  return { valid: errors.length === 0, ast, errors, warnings };
}
