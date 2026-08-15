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

/** Split a CSV into trimmed names, preserving a blank entry mid-edit (e.g. the
 * name currently being retyped) while still treating an entirely empty/whitespace
 * string as zero entries (so "Clear all" doesn't leave a stray blank behind). */
function splitCsvPreservingBlanks(csv: string): string[] {
  if (csv.trim() === "") return [];
  return csv.split(",").map((s) => s.trim());
}

/** Detects a same-length CSV edit (i.e. a rename, not an add/remove) and maps
 * each shifted name old -> new, so callers can remap references (like
 * blockedCells/fixedAssignments values) onto the new name instead of losing
 * them when the reference-validity prune runs below. */
function renameMapFromCsvChange(oldCsv: string, newCsv: string): Record<string, string> {
  const oldNames = splitCsvPreservingBlanks(oldCsv);
  const newNames = splitCsvPreservingBlanks(newCsv);
  if (oldNames.length !== newNames.length) return {};

  const renames: Record<string, string> = {};
  oldNames.forEach((oldName, i) => {
    const newName = newNames[i];
    if (oldName !== newName) renames[oldName] = newName;
  });
  return renames;
}

/** Sync responseLabelMeta when the CSV changes: keep existing entries, add new ones with palette colors. */
export function syncResponseLabelMeta(
  csv: string,
  existing: Record<string, CategoryMeta>,
): Record<string, CategoryMeta> {
  const names = splitCsvPreservingBlanks(csv);

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

const DEFAULT_RESPONSE_LABELS = "Agree, Neutral, Disagree";

function defaultExperimental(): ExperimentalConfig {
  return {
    enabled: false,
    prefillMode: "fixed",
    fixedAssignments: {},
    weightedEntries: [],
    responseLabelsCsv: DEFAULT_RESPONSE_LABELS,
    responseLabelMeta: syncResponseLabelMeta(DEFAULT_RESPONSE_LABELS, {}),
  };
}

/** Sync categoryMeta when the CSV changes: keep existing entries, add new ones with palette colors. */
export function syncCategoryMeta(
  csv: string,
  existing: Record<string, CategoryMeta>,
): Record<string, CategoryMeta> {
  const names = splitCsvPreservingBlanks(csv);

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
  const barriersCsv = config.layout.barriersCsv ?? "";
  return {
    ...config,
    layout: {
      ...config.layout,
      barriersCsv,
      barrierMeta: syncCategoryMeta(barriersCsv, config.layout.barrierMeta ?? {}),
      blockedCells: config.layout.blockedCells ?? {},
    },
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
    barriersCsv: "",
    barrierMeta: {},
    blockedCells: {},
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

  const defaultCsv = "Family, Friends, Coworkers, Neighbors";
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
    case "updateLayout": {
      const mergedLayout = { ...state.config.layout, ...action.patch };
      if (action.patch.barriersCsv !== undefined) {
        // Remap blockedCells onto a renamed barrier's new name before pruning,
        // so renaming a barrier (including an unnamed one) doesn't wipe out
        // the cells already blocked with it.
        const renames = renameMapFromCsvChange(
          state.config.layout.barriersCsv,
          action.patch.barriersCsv,
        );
        mergedLayout.barrierMeta = syncCategoryMeta(
          action.patch.barriersCsv,
          mergedLayout.barrierMeta,
        );
        // Prune blockedCells referencing barrier types that no longer exist.
        const validBarriers = new Set(
          splitCsvPreservingBlanks(action.patch.barriersCsv),
        );
        mergedLayout.blockedCells = Object.fromEntries(
          Object.entries(mergedLayout.blockedCells)
            .map(([k, v]) => [k, renames[v] ?? v] as [string, string])
            .filter(([, v]) => validBarriers.has(v)),
        );
      }
      return {
        ...state,
        config: {
          ...state.config,
          layout: mergedLayout,
        },
      };
    }
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
        // Remap fixedAssignments/weightedEntries onto a renamed category's new
        // name before pruning, so renaming a category (including an unnamed
        // one) doesn't wipe out cells already painted/weighted with it.
        const renames = renameMapFromCsvChange(
          state.config.survey.categoriesCsv,
          action.patch.categoriesCsv,
        );
        merged.categoryMeta = syncCategoryMeta(
          action.patch.categoriesCsv,
          merged.categoryMeta,
        );
        // Prune fixedAssignments referencing categories that no longer exist
        const validCats = new Set(
          splitCsvPreservingBlanks(action.patch.categoriesCsv),
        );
        const exp = state.config.experimental!;
        const prunedAssignments = Object.fromEntries(
          Object.entries(exp.fixedAssignments)
            .map(([k, v]) => [k, renames[v] ?? v] as [string, string])
            .filter(([, v]) => validCats.has(v)),
        );
        const prunedWeights = exp.weightedEntries
          .map((e) => ({ ...e, category: renames[e.category] ?? e.category }))
          .filter((e) => validCats.has(e.category));
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
