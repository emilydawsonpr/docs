import { describe, it, expect } from "vitest";
import { compileVisualQuery } from "@/lib/query/compile-visual-query";

describe("compileVisualQuery", () => {
  it("leaves single-word terms unquoted", () => {
    expect(compileVisualQuery([{ termType: "INCLUDE", value: "Bell" }])).toBe("Bell");
  });

  it("quotes terms containing spaces", () => {
    expect(compileVisualQuery([{ termType: "INCLUDE", value: "Aurora Botanicals" }])).toBe('"Aurora Botanicals"');
  });

  it("quotes and strips terms containing a double-quote but no spaces", () => {
    // A bare `quote-only` term must still come out balanced, not `"e"-brand"`.
    expect(compileVisualQuery([{ termType: "INCLUDE", value: 'e"brand' }])).toBe('"ebrand"');
  });

  it("combines multiple include terms with OR and excludes with NOT", () => {
    const result = compileVisualQuery([
      { termType: "INCLUDE", value: "Bell" },
      { termType: "ALIAS", value: "Bell Canada" },
      { termType: "EXCLUDE", value: "rebellion" },
    ]);
    expect(result).toBe('(Bell OR "Bell Canada") NOT (rebellion)');
  });
});
