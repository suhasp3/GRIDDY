import { describe, it, expect } from "vitest";
import {
  sanitizeEmbeddedDataField,
  buildQualtricsQsf,
  buildQualtricsQsfForConfig,
  qsfEmbeddedFields,
  QualtricsQsfItem,
} from "./qualtricsExport";
import { GridConfig } from "../grid-types";

function makeConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    id: "abc123",
    name: "Test Grid",
    layout: {
      questionText: "Place the labels",
      rows: 3,
      cols: 3,
      includeCenterCell: true,
      centerCellLabel: "Your House",
      centerRow: null,
      centerCol: null,
      backgroundImageUrl: "",
    },
    tuning: {
      gridGap: 4,
      gridPadding: 8,
      labelFontSizeRem: 0.75,
      cellWidth: 60,
      cellHeight: 60,
      previewWidth: 360,
      previewHeight: 360,
    },
    survey: {
      categoriesCsv: "Dwarves, Elves",
      allowInteraction: true,
      selectionMode: "paint",
      advancedCategories: false,
      categoryMeta: {},
    },
    ...overrides,
  };
}

describe("sanitizeEmbeddedDataField", () => {
  it("passes through a clean alphanumeric name unchanged", () => {
    expect(sanitizeEmbeddedDataField("GridAssignments", "field")).toBe(
      "GridAssignments",
    );
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeEmbeddedDataField("My Field Name", "field")).toBe(
      "My_Field_Name",
    );
  });

  it("collapses multiple consecutive special chars into one underscore", () => {
    expect(sanitizeEmbeddedDataField("hello!!world", "field")).toBe(
      "hello_world",
    );
  });

  it("strips leading and trailing underscores", () => {
    expect(sanitizeEmbeddedDataField("__hello__", "field")).toBe("hello");
  });

  it("prepends fallback when name starts with a digit", () => {
    expect(sanitizeEmbeddedDataField("1Field", "grid")).toBe("grid_1Field");
  });

  it("returns fallback with trailing underscore when name is empty", () => {
    // cleaned="" fails the letter/underscore prefix check, so fallback+"_"+cleaned="fallback_"
    expect(sanitizeEmbeddedDataField("", "fallback")).toBe("fallback_");
  });

  it("returns fallback with trailing underscore when name is only special characters", () => {
    // special chars collapse to "" after stripping → same path as empty name
    expect(sanitizeEmbeddedDataField("!!!@@@", "fallback")).toBe("fallback_");
  });

  it("truncates to 64 characters", () => {
    const long = "A".repeat(80);
    const result = sanitizeEmbeddedDataField(long, "field");
    expect(result.length).toBe(64);
    expect(result).toBe("A".repeat(64));
  });

  it("handles underscores in name without modification", () => {
    expect(sanitizeEmbeddedDataField("Grid_Assignments_2024", "field")).toBe(
      "Grid_Assignments_2024",
    );
  });

  it("handles name starting with underscore by prepending fallback", () => {
    // Leading underscores get stripped, leaving a valid identifier
    expect(sanitizeEmbeddedDataField("_ValidName", "field")).toBe("ValidName");
  });
});

describe("qsfEmbeddedFields", () => {
  it("returns the standard assignment field for non-experimental configs", () => {
    expect(qsfEmbeddedFields({ title: "t", config: makeConfig() })).toEqual([
      "GridAssignments",
    ]);
  });

  it("returns prefill and response fields for experimental configs", () => {
    const config = makeConfig({
      experimental: {
        enabled: true,
        prefillMode: "fixed",
        fixedAssignments: {},
        weightedEntries: [],
        responseLabelsCsv: "Good, Bad",
        responseLabelMeta: {},
      },
    });
    expect(qsfEmbeddedFields({ title: "t", config })).toEqual([
      "GridPrefills",
      "GridResponses",
    ]);
  });

  it("honors custom field names", () => {
    const item: QualtricsQsfItem = {
      title: "t",
      config: makeConfig(),
      embeddedDataField: "Custom_Field",
    };
    expect(qsfEmbeddedFields(item)).toEqual(["Custom_Field"]);
  });
});

describe("buildQualtricsQsf", () => {
  it("produces a valid QSF JSON document with SurveyEntry and SurveyElements", () => {
    const qsf = JSON.parse(buildQualtricsQsfForConfig(makeConfig()));
    expect(qsf.SurveyEntry).toBeDefined();
    expect(qsf.SurveyEntry.SurveyName).toBe("Test Grid");
    expect(Array.isArray(qsf.SurveyElements)).toBe(true);

    const elementTypes = qsf.SurveyElements.map((e: { Element: string }) => e.Element);
    // Element set mirrors a real Qualtrics export so the importer accepts it.
    for (const required of [
      "BL",
      "FL",
      "PL",
      "PROJ",
      "QC",
      "QG",
      "QGO",
      "RS",
      "SCO",
      "SO",
      "SQ",
      "STAT",
    ]) {
      expect(elementTypes).toContain(required);
    }

    // BL Payload must be a JSON array of blocks (object form fails import).
    const blockEl = qsf.SurveyElements.find(
      (e: { Element: string }) => e.Element === "BL",
    );
    expect(Array.isArray(blockEl.Payload)).toBe(true);
  });

  it("sets a non-empty SurveyBrandID (importer requires length >= 1)", () => {
    const qsf = JSON.parse(buildQualtricsQsfForConfig(makeConfig()));
    expect(qsf.SurveyEntry.SurveyBrandID.length).toBeGreaterThanOrEqual(1);
  });

  it("attaches the rendering JavaScript to each question as a DB/TB question", () => {
    const qsf = JSON.parse(buildQualtricsQsfForConfig(makeConfig()));
    const questions = qsf.SurveyElements.filter(
      (e: { Element: string }) => e.Element === "SQ",
    );
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.Payload.QuestionType).toBe("DB");
    expect(q.Payload.Selector).toBe("TB");
    expect(q.Payload.QuestionJS).toContain("Qualtrics.SurveyEngine.addOnReady");
  });

  it("declares all embedded data fields in the Survey Flow", () => {
    const qsf = JSON.parse(buildQualtricsQsfForConfig(makeConfig()));
    const flow = qsf.SurveyElements.find(
      (e: { Element: string }) => e.Element === "FL",
    );
    const edElement = flow.Payload.Flow.find(
      (f: { Type: string }) => f.Type === "EmbeddedData",
    );
    const fields = edElement.EmbeddedData.map((d: { Field: string }) => d.Field);
    expect(fields).toContain("GridAssignments");
  });

  it("creates one block and question per item for bundles, with unique fields", () => {
    const items: QualtricsQsfItem[] = [
      { title: "A", config: makeConfig(), embeddedDataField: "GridAssignments_A" },
      { title: "B", config: makeConfig(), embeddedDataField: "GridAssignments_B" },
    ];
    const qsf = JSON.parse(buildQualtricsQsf(items, "Bundle"));

    const questions = qsf.SurveyElements.filter(
      (e: { Element: string }) => e.Element === "SQ",
    );
    expect(questions).toHaveLength(2);

    const blockEl = qsf.SurveyElements.find(
      (e: { Element: string }) => e.Element === "BL",
    );
    expect(Array.isArray(blockEl.Payload)).toBe(true);
    expect(blockEl.Payload).toHaveLength(2);

    const flow = qsf.SurveyElements.find(
      (e: { Element: string }) => e.Element === "FL",
    );
    const blockFlows = flow.Payload.Flow.filter(
      (f: { Type: string }) => f.Type === "Block",
    );
    expect(blockFlows).toHaveLength(2);

    const edElement = flow.Payload.Flow.find(
      (f: { Type: string }) => f.Type === "EmbeddedData",
    );
    const fields = edElement.EmbeddedData.map((d: { Field: string }) => d.Field);
    expect(fields).toEqual(["GridAssignments_A", "GridAssignments_B"]);
  });

  it("uses parameterized prefill/response fields in experimental snippets", () => {
    const config = makeConfig({
      experimental: {
        enabled: true,
        prefillMode: "fixed",
        fixedAssignments: { "r1-c1": "Dwarves" },
        weightedEntries: [],
        responseLabelsCsv: "Good, Bad",
        responseLabelMeta: {},
      },
    });
    const item: QualtricsQsfItem = {
      title: "Exp",
      config,
      prefillsField: "MyPrefills",
      responsesField: "MyResponses",
    };
    const qsf = JSON.parse(buildQualtricsQsf([item], "Exp"));
    const q = qsf.SurveyElements.find(
      (e: { Element: string }) => e.Element === "SQ",
    );
    expect(q.Payload.QuestionJS).toContain('setEmbeddedData("MyPrefills"');
    expect(q.Payload.QuestionJS).toContain('setEmbeddedData("MyResponses"');
  });
});
