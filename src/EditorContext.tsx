import React, { createContext, useContext, useMemo, useReducer } from "react";
import {
  CategoryMeta,
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

/** Sync categoryMeta when the CSV changes: keep existing entries, add new ones with palette colors. */
function syncCategoryMeta(
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

interface EditorState {
  config: GridConfig;
}

type EditorAction =
  | { type: "setConfig"; config: GridConfig }
  | { type: "updateLayout"; patch: Partial<LayoutConfig> }
  | { type: "updateTuning"; patch: Partial<TuningConfig> }
  | { type: "updateSurvey"; patch: Partial<SurveyConfig> };

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
    advancedCategories: false,
    categoryMeta: syncCategoryMeta(defaultCsv, {}),
  };

  return {
    id: crypto.randomUUID(),
    name: "Task 1",
    layout,
    tuning,
    survey,
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setConfig":
      return { config: action.config };
    case "updateLayout":
      return {
        config: {
          ...state.config,
          layout: { ...state.config.layout, ...action.patch },
        },
      };
    case "updateTuning":
      return {
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
      }
      return { config: { ...state.config, survey: merged } };
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

