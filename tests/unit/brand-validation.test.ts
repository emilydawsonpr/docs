import { describe, it, expect } from "vitest";
import { updateBrandSchema, createCompetitorSchema } from "@/lib/validation/brand";
import { createKeyMessageSchema, updateKeyMessageSchema } from "@/lib/validation/key-message";

describe("updateBrandSchema", () => {
  it("accepts a partial update with only some fields set", () => {
    const parsed = updateBrandSchema.parse({ name: "Northstar Coffee", aliases: ["NSC"] });
    expect(parsed.name).toBe("Northstar Coffee");
    expect(parsed.websites).toBeUndefined();
  });

  it("rejects an empty name", () => {
    expect(() => updateBrandSchema.parse({ name: "" })).toThrow();
  });
});

describe("createCompetitorSchema", () => {
  it("requires a non-empty name and defaults aliases to []", () => {
    const parsed = createCompetitorSchema.parse({ name: "Second Cup" });
    expect(parsed.aliases).toEqual([]);
  });

  it("rejects a missing name", () => {
    expect(() => createCompetitorSchema.parse({})).toThrow();
  });
});

describe("key message schemas", () => {
  it("createKeyMessageSchema requires text and defaults aliases to []", () => {
    const parsed = createKeyMessageSchema.parse({ text: "We source 100% Canadian ingredients." });
    expect(parsed.aliases).toEqual([]);
    expect(() => createKeyMessageSchema.parse({})).toThrow();
  });

  it("updateKeyMessageSchema allows a partial update", () => {
    const parsed = updateKeyMessageSchema.parse({ aliases: ["locally sourced"] });
    expect(parsed.text).toBeUndefined();
    expect(parsed.aliases).toEqual(["locally sourced"]);
  });
});
