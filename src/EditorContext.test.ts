import { describe, it, expect } from "vitest";
import {
  syncCategoryMeta,
  editorReducer,
  normalizeConfig,
  encodeNamesCsv,
  splitCsvPreservingBlanks,
} from "./EditorContext";
import type { GridConfig } from "./grid-types";

// ─── encodeNamesCsv / splitCsvPreservingBlanks ─────────────────────────────────

describe("encodeNamesCsv / splitCsvPreservingBlanks round trip", () => {
  it("round-trips zero items", () => {
    expect(encodeNamesCsv([])).toBe("");
    expect(splitCsvPreservingBlanks(encodeNamesCsv([]))).toEqual([]);
  });

  it("round-trips a single blank item distinctly from zero items", () => {
    const csv = encodeNamesCsv([""]);
    expect(csv).not.toBe(""); // must differ from the zero-items encoding
    expect(splitCsvPreservingBlanks(csv)).toEqual([""]);
  });

  it("round-trips normal multi-item lists", () => {
    const csv = encodeNamesCsv(["Wall", "Road"]);
    expect(splitCsvPreservingBlanks(csv)).toEqual(["Wall", "Road"]);
  });

  it("round-trips a blank item alongside real ones", () => {
    const csv = encodeNamesCsv(["Wall", "", "Road"]);
    expect(splitCsvPreservingBlanks(csv)).toEqual(["Wall", "", "Road"]);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE_FIRST = "#f87171"; // first color in CATEGORY_PALETTE

function makeBaseConfig(): GridConfig {
  return {
    id: "base-id",
    name: "Base",
    layout: {
      questionText: "Q",
      rows: 2,
      cols: 2,
      includeCenterCell: false,
      centerCellLabel: "",
      centerRow: null,
      centerCol: null,
      backgroundImageUrl: "",
      barriersCsv: "",
      barrierMeta: {},
      blockedCells: {},
    },
    tuning: {
      gridGap: 10,
      gridPadding: 0,
      labelFontSizeRem: 1,
      cellWidth: 100,
      cellHeight: 100,
      previewWidth: 400,
      previewHeight: 400,
    },
    survey: {
      categoriesCsv: "A, B",
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
  };
}

function makeState(config?: GridConfig) {
  return { config: config ?? makeBaseConfig(), savedSurveyId: null };
}

// ─── syncCategoryMeta ─────────────────────────────────────────────────────────

describe("syncCategoryMeta", () => {
  it("assigns palette colors to new categories", () => {
    const result = syncCategoryMeta("Red, Blue", {});
    expect(Object.keys(result)).toEqual(["Red", "Blue"]);
    expect(result["Red"].color).toBe(PALETTE_FIRST);
    expect(result["Blue"].color).not.toBe(PALETTE_FIRST);
  });

  it("preserves existing category colors", () => {
    const existing = { Cat: { color: "#abcdef", imageUrl: "" } };
    const result = syncCategoryMeta("Cat, Dog", existing);
    expect(result["Cat"].color).toBe("#abcdef");
  });

  it("drops categories removed from the CSV", () => {
    const existing = { A: { color: "#111111", imageUrl: "" }, B: { color: "#222222", imageUrl: "" } };
    const result = syncCategoryMeta("A", existing);
    expect(Object.keys(result)).toEqual(["A"]);
    expect(result["B"]).toBeUndefined();
  });

  it("returns an empty object for an empty CSV", () => {
    const result = syncCategoryMeta("", {});
    expect(result).toEqual({});
  });

  it("trims whitespace around category names", () => {
    const result = syncCategoryMeta("  Alpha ,  Beta  ", {});
    expect(Object.keys(result)).toEqual(["Alpha", "Beta"]);
  });

  it("preserves a blank token instead of dropping it (mid-edit: retyping a name)", () => {
    const result = syncCategoryMeta("A,,B,", {});
    expect(Object.keys(result)).toEqual(["A", "", "B"]);
  });

  it("treats a fully empty/whitespace CSV as zero entries", () => {
    expect(syncCategoryMeta("", {})).toEqual({});
    expect(syncCategoryMeta("   ", {})).toEqual({});
  });

  it("does not assign a color already in use to a new category", () => {
    const existing = {
      A: { color: PALETTE_FIRST, imageUrl: "" },
    };
    const result = syncCategoryMeta("A, B", existing);
    expect(result["B"].color).not.toBe(PALETTE_FIRST);
  });

  it("keeps a category's color while its name is temporarily blank mid-retype", () => {
    // Simulates deleting the last letter of "Cat" (leaving "A,,B") then
    // retyping it back to "Cat" — the color should survive the round trip
    // instead of being reset by a fresh palette pick.
    const withCat = syncCategoryMeta("A, Cat, B", {});
    const catColor = withCat["Cat"].color;

    const midEdit = syncCategoryMeta("A,,B", withCat);
    expect(midEdit[""]).toBeDefined();

    const retyped = syncCategoryMeta("A, Cat, B", midEdit);
    expect(retyped["Cat"].color).toBe(catColor);
  });
});

// ─── editorReducer ────────────────────────────────────────────────────────────

describe("editorReducer", () => {
  it("setConfig: replaces config and runs normalizeConfig", () => {
    const next = makeBaseConfig();
    next.survey.categoriesCsv = "X, Y";
    const state = editorReducer(makeState(), { type: "setConfig", config: next });
    expect(state.config.survey.categoriesCsv).toBe("X, Y");
    // normalizeConfig should have populated categoryMeta
    expect(Object.keys(state.config.survey.categoryMeta)).toEqual(["X", "Y"]);
  });

  it("markSaved: sets savedSurveyId to current config id", () => {
    const state = editorReducer(makeState(), { type: "markSaved" });
    expect(state.savedSurveyId).toBe("base-id");
  });

  it("newSurvey: resets savedSurveyId to null and creates fresh config", () => {
    const state = editorReducer(
      { ...makeState(), savedSurveyId: "old-id" },
      { type: "newSurvey" },
    );
    expect(state.savedSurveyId).toBeNull();
    expect(state.config.id).not.toBe("base-id");
  });

  it("updateLayout: merges layout patch", () => {
    const state = editorReducer(makeState(), {
      type: "updateLayout",
      patch: { rows: 5 },
    });
    expect(state.config.layout.rows).toBe(5);
    expect(state.config.layout.cols).toBe(2); // unchanged
  });

  it("updateLayout: syncs barrierMeta when barriersCsv changes", () => {
    const state = editorReducer(makeState(), {
      type: "updateLayout",
      patch: { barriersCsv: "Wall, Road" },
    });
    expect(Object.keys(state.config.layout.barrierMeta)).toEqual([
      "Wall",
      "Road",
    ]);
  });

  it("updateLayout: prunes blockedCells for removed barrier types", () => {
    const config = makeBaseConfig();
    config.layout.barriersCsv = "Wall, Road";
    config.layout.blockedCells = { "r1-c1": "Wall", "r1-c2": "Road" };
    const state = editorReducer(makeState(config), {
      type: "updateLayout",
      patch: { barriersCsv: "Wall" }, // Road removed
    });
    expect(state.config.layout.blockedCells).toEqual({ "r1-c1": "Wall" });
  });

  it("updateLayout: remaps blockedCells onto a renamed barrier instead of dropping them", () => {
    const config = makeBaseConfig();
    config.layout.barriersCsv = "Wall, Road";
    config.layout.blockedCells = { "r1-c1": "Wall", "r1-c2": "Road" };
    const state = editorReducer(makeState(config), {
      type: "updateLayout",
      patch: { barriersCsv: "Fence, Road" }, // "Wall" renamed to "Fence"
    });
    expect(state.config.layout.blockedCells).toEqual({
      "r1-c1": "Fence",
      "r1-c2": "Road",
    });
  });

  it("updateLayout: keeps blockedCells when the only barrier's name is cleared to blank", () => {
    // Regression: a single barrier's name join()-ing to "" is indistinguishable
    // from zero barriers unless the editor uses the "," sentinel from
    // encodeNamesCsv — this simulates that encoded patch.
    const config = makeBaseConfig();
    config.layout.barriersCsv = "Wall";
    config.layout.blockedCells = { "r1-c1": "Wall" };
    const state = editorReducer(makeState(config), {
      type: "updateLayout",
      patch: { barriersCsv: "," }, // "Wall" cleared to blank (sentinel-encoded)
    });
    expect(state.config.layout.blockedCells).toEqual({ "r1-c1": "" });
    expect(Object.keys(state.config.layout.barrierMeta)).toEqual([""]);
  });

  it("updateLayout: remaps blockedCells when an unnamed barrier is renamed", () => {
    const config = makeBaseConfig();
    config.layout.barriersCsv = ", Road";
    config.layout.blockedCells = { "r1-c1": "", "r1-c2": "Road" };
    const state = editorReducer(makeState(config), {
      type: "updateLayout",
      patch: { barriersCsv: "Wall, Road" }, // unnamed barrier renamed to "Wall"
    });
    expect(state.config.layout.blockedCells).toEqual({
      "r1-c1": "Wall",
      "r1-c2": "Road",
    });
  });

  it("updateTuning: merges tuning patch", () => {
    const state = editorReducer(makeState(), {
      type: "updateTuning",
      patch: { cellWidth: 200 },
    });
    expect(state.config.tuning.cellWidth).toBe(200);
    expect(state.config.tuning.cellHeight).toBe(100); // unchanged
  });

  it("updateSurvey: merges survey patch without pruning when no CSV change", () => {
    const state = editorReducer(makeState(), {
      type: "updateSurvey",
      patch: { allowInteraction: false },
    });
    expect(state.config.survey.allowInteraction).toBe(false);
    expect(state.config.survey.categoriesCsv).toBe("A, B");
  });

  it("updateSurvey: prunes fixedAssignments for removed categories", () => {
    const config = makeBaseConfig();
    config.experimental!.fixedAssignments = { cell1: "A", cell2: "B" };
    const state = editorReducer(makeState(config), {
      type: "updateSurvey",
      patch: { categoriesCsv: "A" }, // B removed
    });
    expect(state.config.experimental!.fixedAssignments).toEqual({ cell1: "A" });
  });

  it("updateSurvey: prunes weightedEntries for removed categories", () => {
    const config = makeBaseConfig();
    config.experimental!.weightedEntries = [
      { category: "A", weight: 1 },
      { category: "B", weight: 2 },
    ];
    const state = editorReducer(makeState(config), {
      type: "updateSurvey",
      patch: { categoriesCsv: "A" },
    });
    expect(state.config.experimental!.weightedEntries).toEqual([
      { category: "A", weight: 1 },
    ]);
  });

  it("updateSurvey: remaps fixedAssignments/weightedEntries onto a renamed category", () => {
    const config = makeBaseConfig();
    config.experimental!.fixedAssignments = { cell1: "A", cell2: "B" };
    config.experimental!.weightedEntries = [
      { category: "A", weight: 1 },
      { category: "B", weight: 2 },
    ];
    const state = editorReducer(makeState(config), {
      type: "updateSurvey",
      patch: { categoriesCsv: "Alpha, B" }, // "A" renamed to "Alpha"
    });
    expect(state.config.experimental!.fixedAssignments).toEqual({
      cell1: "Alpha",
      cell2: "B",
    });
    expect(state.config.experimental!.weightedEntries).toEqual([
      { category: "Alpha", weight: 1 },
      { category: "B", weight: 2 },
    ]);
  });

  it("updateExperimental: merges experimental patch", () => {
    const state = editorReducer(makeState(), {
      type: "updateExperimental",
      patch: { enabled: true },
    });
    expect(state.config.experimental!.enabled).toBe(true);
    expect(state.config.experimental!.prefillMode).toBe("fixed"); // unchanged
  });
});

// ─── normalizeConfig ──────────────────────────────────────────────────────────

describe("normalizeConfig", () => {
  it("fills in missing selectionMode with 'paint'", () => {
    const config = makeBaseConfig();
    // @ts-expect-error intentionally removing field
    delete config.survey.selectionMode;
    const result = normalizeConfig(config);
    expect(result.survey.selectionMode).toBe("paint");
  });

  it("syncs categoryMeta from categoriesCsv", () => {
    const config = makeBaseConfig();
    config.survey.categoriesCsv = "Dogs, Cats";
    config.survey.categoryMeta = {};
    const result = normalizeConfig(config);
    expect(Object.keys(result.survey.categoryMeta)).toEqual(["Dogs", "Cats"]);
  });

  it("defaults new barrier layout fields for older configs", () => {
    const config = makeBaseConfig();
    // Simulate an older saved survey lacking the barrier fields.
    // @ts-expect-error intentionally removing fields
    delete config.layout.barriersCsv;
    // @ts-expect-error intentionally removing fields
    delete config.layout.barrierMeta;
    // @ts-expect-error intentionally removing fields
    delete config.layout.blockedCells;
    const result = normalizeConfig(config);
    expect(result.layout.barriersCsv).toBe("");
    expect(result.layout.barrierMeta).toEqual({});
    expect(result.layout.blockedCells).toEqual({});
  });

  it("syncs barrierMeta from barriersCsv", () => {
    const config = makeBaseConfig();
    config.layout.barriersCsv = "Wall, Road";
    config.layout.barrierMeta = {};
    const result = normalizeConfig(config);
    expect(Object.keys(result.layout.barrierMeta)).toEqual(["Wall", "Road"]);
  });

  it("fills in missing experimental fields with defaults", () => {
    const config = makeBaseConfig();
    delete config.experimental;
    const result = normalizeConfig(config);
    expect(result.experimental).toMatchObject({
      enabled: false,
      prefillMode: "fixed",
      fixedAssignments: {},
      weightedEntries: [],
    });
  });
});
