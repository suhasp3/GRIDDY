import React, { createContext, useContext, useMemo, useReducer } from "react";
import {
  CategoryMeta,
  ExperimentalConfig,
  GridConfig,
  LayoutConfig,
  SurveyConfig,
  TuningConfig,
} from "./grid-types";

const CATEGORY_PALETTE = [
  "#f87171", // red
  "#60a5fa", // blue
  "#4ade80", // green
  "#fb923c", // orange
  "#c084fc", // purple
  "#facc15", // yellow
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a3e635", // lime
  "#fb7185", // rose
];

/** Sync responseLabelMeta when the CSV changes: keep existing entries, add new ones with palette colors. */
export function syncResponseLabelMeta(
  csv: string,
  existing: Record<string, CategoryMeta>,
): Record<string, CategoryMeta> {
  const names = csv
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const usedColors = new Set(Object.values(existing).map((m) => m.color));
  let paletteIdx = 0;

  const next: Record<string, CategoryMeta> = {};
  for (const name of names) {
    if (existing[name]) {
      next[name] = existing[name];
    } else {
      while (
        paletteIdx < CATEGORY_PALETTE.length &&
        usedColors.has(CATEGORY_PALETTE[paletteIdx])
      ) {
        paletteIdx++;
      }
      const color = CATEGORY_PALETTE[paletteIdx % CATEGORY_PALETTE.length];
      usedColors.add(color);
      paletteIdx++;
      next[name] = { color, imageUrl: "" };
    }
  }
  return next;
}

function defaultExperimental(): ExperimentalConfig {
  return {
    enabled: false,
    prefillMode: "fixed",
    fixedAssignments: {},
    weightedEntries: [],
    responseLabelsCsv: "",
    responseLabelMeta: {},
  };
}

/** Sync categoryMeta when the CSV changes: keep existing entries, add new ones with palette colors. */
export function syncCategoryMeta(
  csv: string,
  existing: Record<string, CategoryMeta>,
): Record<string, CategoryMeta> {
  const names = csv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const usedColors = new Set(Object.values(existing).map((m) => m.color));
  let paletteIdx = 0;

  const next: Record<string, CategoryMeta> = {};
  for (const name of names) {
    if (existing[name]) {
      next[name] = existing[name];
    } else {
      while (
        paletteIdx < CATEGORY_PALETTE.length &&
        usedColors.has(CATEGORY_PALETTE[paletteIdx])
      ) {
        paletteIdx++;
      }
      const color = CATEGORY_PALETTE[paletteIdx % CATEGORY_PALETTE.length];
      usedColors.add(color);
      paletteIdx++;
      next[name] = { color, imageUrl: "" };
    }
  }
  return next;
}

export function normalizeConfig(config: GridConfig): GridConfig {
  const categoriesCsv = config.survey.categoriesCsv ?? "";
  const existingExp: Partial<ExperimentalConfig> = config.experimental ?? {};
  return {
    ...config,
    survey: {
      ...config.survey,
      selectionMode: config.survey.selectionMode ?? "paint",
      categoryMeta: syncCategoryMeta(
        categoriesCsv,
        config.survey.categoryMeta ?? {},
      ),
    },
    experimental: {
      ...defaultExperimental(),
      ...existingExp,
      fixedAssignments: existingExp.fixedAssignments ?? {},
      weightedEntries: existingExp.weightedEntries ?? [],
      responseLabelMeta: syncResponseLabelMeta(
        existingExp.responseLabelsCsv ?? "",
        existingExp.responseLabelMeta ?? {},
      ),
    },
  };
}

interface EditorState {
  config: GridConfig;
  savedSurveyId: string | null;
}

type EditorAction =
  | { type: "setConfig"; config: GridConfig }
  | { type: "updateLayout"; patch: Partial<LayoutConfig> }
  | { type: "updateTuning"; patch: Partial<TuningConfig> }
  | { type: "updateSurvey"; patch: Partial<SurveyConfig> }
  | { type: "updateExperimental"; patch: Partial<ExperimentalConfig> }
  | { type: "markSaved" }
  | { type: "newSurvey" };

const EditorContext = createContext<
  { state: EditorState; dispatch: React.Dispatch<EditorAction> } | undefined
>(undefined);

function createDefaultConfig(): GridConfig {
  const layout: LayoutConfig = {
    questionText: "Who lives where? Fill in the grid:",
    rows: 3,
    cols: 3,
    includeCenterCell: true,
    centerCellLabel: "Your House",
    centerRow: null,
    centerCol: null,
    backgroundImageUrl: "",
  };

  const tuning: TuningConfig = {
    gridGap: 10,
    gridPadding: 0,
    labelFontSizeRem: 1,
    cellWidth: 100,
    cellHeight: 120,
    previewWidth: 550,
    previewHeight: 550,
  };

  const defaultCsv = "Dwarves, Elves, Hobbits, Rohirrim";
  const survey: SurveyConfig = {
    categoriesCsv: defaultCsv,
    allowInteraction: true,
    selectionMode: "paint",
    advancedCategories: false,
    categoryMeta: syncCategoryMeta(defaultCsv, {}),
  };

  return {
    id: crypto.randomUUID(),
    name: "",
    layout,
    tuning,
    survey,
    experimental: defaultExperimental(),
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setConfig":
      return { ...state, config: normalizeConfig(action.config) };
    case "markSaved":
      return { ...state, savedSurveyId: state.config.id };
    case "newSurvey":
      return { config: createDefaultConfig(), savedSurveyId: null };
    case "updateLayout":
      return {
        ...state,
        config: {
          ...state.config,
          layout: { ...state.config.layout, ...action.patch },
        },
      };
    case "updateTuning":
      return {
        ...state,
        config: {
          ...state.config,
          tuning: { ...state.config.tuning, ...action.patch },
        },
      };
    case "updateSurvey": {
      const merged = { ...state.config.survey, ...action.patch };
      if (action.patch.categoriesCsv !== undefined) {
        merged.categoryMeta = syncCategoryMeta(
          action.patch.categoriesCsv,
          merged.categoryMeta,
        );
        // Prune fixedAssignments referencing categories that no longer exist
        const validCats = new Set(
          action.patch.categoriesCsv
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        );
        const exp = state.config.experimental!;
        const prunedAssignments = Object.fromEntries(
          Object.entries(exp.fixedAssignments).filter(([, v]) => validCats.has(v)),
        );
        const prunedWeights = exp.weightedEntries.filter((e) =>
          validCats.has(e.category),
        );
        return {
          ...state,
          config: {
            ...state.config,
            survey: merged,
            experimental: {
              ...exp,
              fixedAssignments: prunedAssignments,
              weightedEntries: prunedWeights,
            },
          },
        };
      }
      return { ...state, config: { ...state.config, survey: merged } };
    }
    case "updateExperimental": {
      const merged: ExperimentalConfig = {
        ...state.config.experimental!,
        ...action.patch,
      };
      if (action.patch.responseLabelsCsv !== undefined) {
        merged.responseLabelMeta = syncResponseLabelMeta(
          action.patch.responseLabelsCsv,
          merged.responseLabelMeta,
        );
      }
      return { ...state, config: { ...state.config, experimental: merged } };
    }
    default:
      return state;
  }
}

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(editorReducer, {
    config: createDefaultConfig(),
    savedSurveyId: null,
  });

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return ctx;
}
