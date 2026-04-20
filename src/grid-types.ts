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

export interface CategoryMeta {
  color: string;    // hex color, e.g. "#f87171"
  imageUrl: string; // optional image URL shown in cell
}

export type SelectionMode = "paint" | "dropdown" | "dragdrop";

export interface SurveyConfig {
  /** Comma-separated list of category labels, e.g. "Dwarves, Elves, Hobbits" */
  categoriesCsv: string;
  /** Whether participants can interact with the grid (vs static display only). */
  allowInteraction: boolean;
  /** How respondents assign labels to cells when interaction is enabled. */
  selectionMode: SelectionMode;
  /** Whether the advanced per-category customization panel is expanded. */
  advancedCategories: boolean;
  /** Per-category color and image metadata, keyed by category name. */
  categoryMeta: Record<string, CategoryMeta>;
}

export type ExperimentalPrefillMode = "fixed" | "shuffle" | "weighted";

export interface WeightEntry {
  category: string;
  weight: number; // raw number, not required to sum to 100
}

export interface ExperimentalConfig {
  enabled: boolean;
  prefillMode: ExperimentalPrefillMode;
  /** cellKey format "r{row}-c{col}" -> category name */
  fixedAssignments: Record<string, string>;
  weightedEntries: WeightEntry[];
  responseLabelsCsv: string;
  /** Per-response-label color and image metadata, keyed by label name. */
  responseLabelMeta: Record<string, CategoryMeta>;
}

export interface GridConfig {
  id: string;
  name: string;
  layout: LayoutConfig;
  tuning: TuningConfig;
  survey: SurveyConfig;
  experimental?: ExperimentalConfig;
}
