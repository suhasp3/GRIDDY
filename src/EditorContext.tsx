import React, { createContext, useContext, useMemo, useReducer } from "react";
import {
  GridConfig,
  LayoutConfig,
  SurveyConfig,
  TuningConfig,
} from "./grid-types";

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

  const survey: SurveyConfig = {
    categoriesCsv: "Dwarves, Elves, Hobbits, Rohirrim",
    allowInteraction: true,
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
    case "updateSurvey":
      return {
        config: {
          ...state.config,
          survey: { ...state.config.survey, ...action.patch },
        },
      };
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

