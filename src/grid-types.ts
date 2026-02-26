export type SkipBehavior = "remind" | "allow" | "force";

export interface LayoutConfig {
  questionText: string;
  rows: number;
  cols: number;
  includeCenterCell: boolean;
  centerCellLabel: string;
  centerRow: number | null; // 1-based; null = auto
  centerCol: number | null; // 1-based; null = auto
  backgroundImageUrl: string;
}

export interface TuningConfig {
  gridGap: number;
  gridPadding: number;
  labelFontSizeRem: number;
  cellWidth: number;
  cellHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export interface SurveyConfig {
  /** Comma-separated list of category labels, e.g. "Dwarves, Elves, Hobbits" */
  categoriesCsv: string;
  /** Whether participants can interact with the grid (vs static display only). */
  allowInteraction: boolean;
}

export interface GridConfig {
  id: string;
  name: string;
  layout: LayoutConfig;
  tuning: TuningConfig;
  survey: SurveyConfig;
}

