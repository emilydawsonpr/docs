import { describe, it, expect } from "vitest";
import { textMentionsAnyName } from "@/lib/utils";

describe("textMentionsAnyName", () => {
  it("matches a whole-word brand name", () => {
    expect(textMentionsAnyName("Bell announced record earnings today.", ["Bell"])).toBe(true);
  });

  it("does not match a brand name as a substring of an unrelated word", () => {
    expect(textMentionsAnyName("The rebellion spread across the province.", ["Bell"])).toBe(false);
  });

  it("matches a multi-word phrase", () => {
    expect(textMentionsAnyName("Northstar Coffee opens a new cafe.", ["Northstar Coffee"])).toBe(true);
  });

  it("does not match a multi-word phrase as a partial substring", () => {
    expect(textMentionsAnyName("The Northstar Coffeehouse chain expanded.", ["Northstar Coffee"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(textMentionsAnyName("BELL CANADA reported results.", ["Bell Canada"])).toBe(true);
  });

  it("matches accented French names correctly", () => {
    expect(textMentionsAnyName("Aurora Botanicals ouvre une boutique à Montréal.", ["Montréal"])).toBe(true);
  });

  it("checks multiple candidate names and matches if any hits", () => {
    expect(textMentionsAnyName("Second Cup announced a new location.", ["Tim Hortons", "Second Cup"])).toBe(true);
  });

  it("returns false for an empty names list", () => {
    expect(textMentionsAnyName("Some text here.", [])).toBe(false);
  });
});
