import { describe, it, expect } from "vitest";
import {
  syncCategoryMeta,
  editorReducer,
  normalizeConfig,
} from "./EditorContext";
import type { GridConfig } from "./grid-types";

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

  it("skips empty tokens from the CSV", () => {
    const result = syncCategoryMeta("A,,B,", {});
    expect(Object.keys(result)).toEqual(["A", "B"]);
  });

  it("does not assign a color already in use to a new category", () => {
    const existing = {
      A: { color: PALETTE_FIRST, imageUrl: "" },
    };
    const result = syncCategoryMeta("A, B", existing);
    expect(result["B"].color).not.toBe(PALETTE_FIRST);
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
