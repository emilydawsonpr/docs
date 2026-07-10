import { describe, it, expect } from "vitest";
import { parseQuery, evaluateQuery, validateQuery, QueryParseError } from "@/lib/query/boolean-parser";

describe("boolean-parser: parseQuery", () => {
  it("parses a simple AND expression", () => {
    const ast = parseQuery("Toronto AND coffee");
    expect(ast).toEqual({
      type: "AND",
      children: [
        { type: "TERM", value: "Toronto", wildcard: false },
        { type: "TERM", value: "coffee", wildcard: false },
      ],
    });
  });

  it("parses OR with lower precedence than AND", () => {
    const ast = parseQuery("a AND b OR c");
    // (a AND b) OR c
    expect(ast).toEqual({
      type: "OR",
      children: [
        { type: "AND", children: [{ type: "TERM", value: "a", wildcard: false }, { type: "TERM", value: "b", wildcard: false }] },
        { type: "TERM", value: "c", wildcard: false },
      ],
    });
  });

  it("parses quoted phrases", () => {
    const ast = parseQuery('"Northstar Coffee" OR "North Star Coffee"');
    expect(ast.type).toBe("OR");
  });

  it("parses NOT with a grouped expression", () => {
    const ast = parseQuery('NOT ("North Star" AND astronomy)');
    expect(ast.type).toBe("NOT");
  });

  it("parses the spec example query", () => {
    const q =
      '("Northstar Coffee" OR "North Star Coffee" OR @northstarcoffee) AND (Toronto OR Ontario OR Canada) NOT ("North Star" AND astronomy)';
    expect(() => parseQuery(q)).not.toThrow();
  });

  it("throws on unbalanced parentheses", () => {
    expect(() => parseQuery("(Toronto AND coffee")).toThrow(QueryParseError);
  });

  it("throws on unterminated phrase", () => {
    expect(() => parseQuery('"Toronto coffee')).toThrow(QueryParseError);
  });

  it("throws on empty query", () => {
    expect(() => parseQuery("")).toThrow(QueryParseError);
  });

  it("throws on dangling operator", () => {
    expect(() => parseQuery("Toronto AND")).toThrow(QueryParseError);
  });

  it("supports wildcard terms", () => {
    const ast = parseQuery("sustainab*");
    expect(ast).toEqual({ type: "TERM", value: "sustainab", wildcard: true });
  });
});

describe("boolean-parser: evaluateQuery", () => {
  it("matches AND when both terms present", () => {
    const ast = parseQuery("Toronto AND coffee");
    expect(evaluateQuery(ast, "A great coffee shop opens in Toronto")).toBe(true);
    expect(evaluateQuery(ast, "A great coffee shop opens in Vancouver")).toBe(false);
  });

  it("matches OR when either term present", () => {
    const ast = parseQuery("Toronto OR Vancouver");
    expect(evaluateQuery(ast, "News from Vancouver today")).toBe(true);
  });

  it("matches NOT correctly", () => {
    const ast = parseQuery('coffee NOT astronomy');
    expect(evaluateQuery(ast, "coffee shop news")).toBe(true);
    expect(evaluateQuery(ast, "coffee and astronomy conference")).toBe(false);
  });

  it("matches exact phrases", () => {
    const ast = parseQuery('"North Star Coffee"');
    expect(evaluateQuery(ast, "Visit North Star Coffee today")).toBe(true);
    expect(evaluateQuery(ast, "Visit the North Star, get Coffee")).toBe(false);
  });

  it("matches wildcard prefix", () => {
    const ast = parseQuery("sustainab*");
    expect(evaluateQuery(ast, "Our sustainability report is out")).toBe(true);
    expect(evaluateQuery(ast, "No relevant word here")).toBe(false);
  });

  it("evaluates the full spec example against a matching article", () => {
    const ast = parseQuery(
      '("Northstar Coffee" OR "North Star Coffee" OR @northstarcoffee) AND (Toronto OR Ontario OR Canada) NOT ("North Star" AND astronomy)'
    );
    expect(evaluateQuery(ast, "Northstar Coffee opens its newest cafe in Toronto, Ontario")).toBe(true);
    expect(evaluateQuery(ast, "The North Star constellation is a topic in astronomy circles")).toBe(false);
    expect(evaluateQuery(ast, "Northstar Coffee expands into the United States")).toBe(false);
  });
});

describe("boolean-parser: validateQuery", () => {
  it("flags syntax errors", () => {
    const result = validateQuery("(Toronto AND coffee");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("warns about short/common bare terms", () => {
    const result = validateQuery("news");
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("short or very common"))).toBe(true);
  });

  it("warns about missing brand aliases", () => {
    const result = validateQuery('"Northstar Coffee" AND Toronto', {
      brandAliases: ["Northstar Coffee", "North Star Coffee"],
    });
    expect(result.warnings.some((w) => w.includes("North Star Coffee"))).toBe(true);
  });

  it("warns about too many OR branches", () => {
    const terms = Array.from({ length: 10 }, (_, i) => `"term ${i}"`).join(" OR ");
    const result = validateQuery(terms);
    expect(result.warnings.some((w) => w.includes("OR-ed alternatives"))).toBe(true);
  });

  it("accepts a well-formed narrow query with no warnings about ambiguity", () => {
    const result = validateQuery('"Northstar Coffee" AND (Toronto OR Ontario)');
    expect(result.valid).toBe(true);
  });
});
