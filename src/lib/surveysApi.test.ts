import { describe, it, expect } from "vitest";
import { stableStringify, surveyFingerprint } from "./surveysApi";
import type { GridConfig } from "../grid-types";

// ─── stableStringify ───────────────────────────────────────────────────────────

describe("stableStringify", () => {
  it("serializes null", () => {
    expect(stableStringify(null)).toBe("null");
  });

  it("serializes a number", () => {
    expect(stableStringify(42)).toBe("42");
  });

  it("serializes a string", () => {
    expect(stableStringify("hello")).toBe('"hello"');
  });

  it("serializes a boolean", () => {
    expect(stableStringify(true)).toBe("true");
  });

  it("serializes an empty array", () => {
    expect(stableStringify([])).toBe("[]");
  });

  it("serializes an array of primitives", () => {
    expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
  });

  it("serializes object keys in sorted order", () => {
    // z before a in natural order, but sorted output puts a first
    const obj = { z: 1, a: 2 };
    expect(stableStringify(obj)).toBe('{"a":2,"z":1}');
  });

  it("produces the same output regardless of key insertion order", () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("handles nested objects with stable key order", () => {
    const obj = { b: { d: 4, c: 3 }, a: 1 };
    expect(stableStringify(obj)).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  it("handles arrays of objects", () => {
    const arr = [{ b: 2, a: 1 }, { d: 4, c: 3 }];
    expect(stableStringify(arr)).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });
});

// ─── surveyFingerprint ─────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    id: "test-id",
    name: "Test Survey",
    layout: {
      questionText: "Who lives where?",
      rows: 3,
      cols: 3,
      includeCenterCell: false,
      centerCellLabel: "",
      centerRow: null,
      centerCol: null,
      backgroundImageUrl: "",
    },
    tuning: {
      gridGap: 10,
      gridPadding: 0,
      labelFontSizeRem: 1,
      cellWidth: 100,
      cellHeight: 120,
      previewWidth: 550,
      previewHeight: 550,
    },
    survey: {
      categoriesCsv: "A, B, C",
      allowInteraction: true,
      selectionMode: "paint",
      advancedCategories: false,
      categoryMeta: {},
    },
    experimental: {
      enabled: false,
      prefillMode: "fixed",
      fixedAssignments: {},
      weightedEntries: [],
      responseLabelsCsv: "",
      responseLabelMeta: {},
    },
    ...overrides,
  };
}

describe("surveyFingerprint", () => {
  it("returns the same fingerprint for identical input", () => {
    const config = makeConfig();
    expect(surveyFingerprint("Test Survey", config)).toBe(
      surveyFingerprint("Test Survey", config),
    );
  });

  it("is case-insensitive and trims whitespace in the name", () => {
    const config = makeConfig();
    const fp1 = surveyFingerprint("  Test Survey  ", config);
    const fp2 = surveyFingerprint("test survey", config);
    expect(fp1).toBe(fp2);
  });

  it("ignores the config id field", () => {
    const config1 = makeConfig({ id: "id-111" });
    const config2 = makeConfig({ id: "id-999" });
    expect(surveyFingerprint("Test Survey", config1)).toBe(
      surveyFingerprint("Test Survey", config2),
    );
  });

  it("returns different fingerprints when content differs", () => {
    const config1 = makeConfig();
    const config2 = makeConfig({
      layout: { ...makeConfig().layout, rows: 5 },
    });
    expect(surveyFingerprint("Test Survey", config1)).not.toBe(
      surveyFingerprint("Test Survey", config2),
    );
  });

  it("returns different fingerprints when names differ", () => {
    const config = makeConfig();
    expect(surveyFingerprint("Survey A", config)).not.toBe(
      surveyFingerprint("Survey B", config),
    );
  });
});
