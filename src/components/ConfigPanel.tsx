import React, { useEffect, useState } from "react";
import { useEditor } from "../EditorContext";
import { CategoryMeta, ExperimentalConfig } from "../grid-types";
import CategoryChips, { ChipItem } from "./CategoryChips";

// ---------------------------------------------------------------------------
// Selection-mode card data
// ---------------------------------------------------------------------------

const SELECTION_MODES = [
  {
    value: "paint" as const,
    label: "Select & click",
    desc: "Pick a label first, then click cells to place or remove it.",
  },
  {
    value: "dropdown" as const,
    label: "Dropdown per cell",
    desc: "Each cell gets its own dropdown so every choice is explicit.",
  },
  {
    value: "dragdrop" as const,
    label: "Drag and drop",
    desc: "Drag labels onto cells for a slower, more intentional flow.",
  },
] as const;

const PREFILL_MODES = [
  {
    value: "fixed" as const,
    label: "Fixed",
    desc: "Every respondent sees the same painted layout.",
  },
  {
    value: "shuffle" as const,
    label: "Shuffle",
    desc: "Your painted assignments are shuffled per respondent.",
  },
  {
    value: "weighted" as const,
    label: "Weighted",
    desc: "Each cell is filled independently from category weights.",
  },
] as const;

// ---------------------------------------------------------------------------
// Small helper: section number badge
// ---------------------------------------------------------------------------

const Num: React.FC<{ n: string; dim?: boolean }> = ({ n, dim }) => (
  <span
    className={`font-serif text-[33px] font-semibold leading-none ${
      dim ? "text-[#c2b59c]" : "text-accent"
    }`}
  >
    {n}
  </span>
);

// ---------------------------------------------------------------------------
// Collapsed summary row (sections 01–03 when experiment is on)
// ---------------------------------------------------------------------------

interface SummaryRowProps {
  num: string;
  title: string;
  summary: React.ReactNode;
  expanded: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}

const SummaryRow: React.FC<SummaryRowProps> = ({
  num,
  title,
  summary,
  expanded,
  onEdit,
  children,
}) => (
  <div className="rounded-xl border border-hairline-warm bg-paper-card">
    <div className="flex items-center gap-3.5 px-4 py-3">
      <span className="font-serif text-lg font-semibold leading-none text-[#c2b59c]">
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-sm font-semibold text-ink">{title}</div>
        {!expanded && (
          <div className="mt-0.5 truncate text-xs text-ink-muted">{summary}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex-shrink-0 text-[12.5px] font-bold text-accent"
      >
        {expanded ? "Done" : "Edit"}
      </button>
    </div>
    {expanded && (
      <div className="border-t border-hairline px-4 pb-4 pt-3">{children}</div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Mode-card row (used for both prefill mode and selection mode)
// ---------------------------------------------------------------------------

interface ModeCardProps {
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}

const ModeCard: React.FC<ModeCardProps> = ({ label, desc, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 cursor-pointer rounded-xl p-3.5 text-left transition-colors ${
      selected
        ? "border-[1.5px] border-accent bg-accent-soft"
        : "border border-hairline bg-white hover:border-accent/30"
    }`}
  >
    <div className="mb-1.5 flex items-center gap-2">
      <span
        className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${
          selected ? "border-accent bg-accent" : "border-[#cdbfa6] bg-white"
        }`}
      />
      <span className="font-serif text-sm font-bold text-ink">{label}</span>
    </div>
    <p className="pl-[22px] text-[11.5px] leading-snug text-ink-muted">{desc}</p>
  </button>
);

// ---------------------------------------------------------------------------
// Convert between chip array and categoryMeta
// ---------------------------------------------------------------------------

function chipItemsFromMeta(
  csv: string,
  meta: Record<string, CategoryMeta>,
  fallbackColor = "#60a5fa",
): ChipItem[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      color: meta[name]?.color ?? fallbackColor,
      imageUrl: meta[name]?.imageUrl ?? "",
      layerMode: meta[name]?.layerMode,
    }));
}

function chipItemsToMeta(items: ChipItem[]): Record<string, CategoryMeta> {
  const out: Record<string, CategoryMeta> = {};
  for (const it of items) {
    out[it.name] = {
      color: it.color,
      imageUrl: it.imageUrl ?? "",
      layerMode: it.layerMode,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Section 01 — Question & Grid (mirrors LayoutTab logic inline)
// ---------------------------------------------------------------------------

const QuestionGridForm: React.FC = () => {
  const { state: { config }, dispatch } = useEditor();
  const layout = config.layout;

  const [rowsInput, setRowsInput] = useState(String(layout.rows));
  const [colsInput, setColsInput] = useState(String(layout.cols));
  const [rowsWarn, setRowsWarn] = useState(false);
  const [colsWarn, setColsWarn] = useState(false);

  useEffect(() => {
    setRowsInput(String(layout.rows));
    setColsInput(String(layout.cols));
    setRowsWarn(false);
    setColsWarn(false);
  }, [config.id]);

  const update = (patch: Partial<typeof layout>) =>
    dispatch({ type: "updateLayout", patch });

  const handleRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsInput(e.target.value);
    const v = Number(e.target.value);
    if (e.target.value === "") return;
    if (v > 10) { setRowsWarn(true); return; }
    setRowsWarn(false);
    update({ rows: v });
  };

  const handleCols = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColsInput(e.target.value);
    const v = Number(e.target.value);
    if (e.target.value === "") return;
    if (v > 10) { setColsWarn(true); return; }
    setColsWarn(false);
    update({ cols: v });
  };

  const inputCls =
    "rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold tracking-widest text-ink-faint">
          QUESTION TEXT
        </span>
        <textarea
          className={`${inputCls} min-h-[80px] resize-none`}
          value={layout.questionText}
          onChange={(e) => update({ questionText: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-widest text-ink-faint">
              ROWS
            </span>
            <input
              type="number"
              min={1}
              max={10}
              className={inputCls}
              value={rowsInput}
              onChange={handleRows}
              onBlur={() => {
                if (rowsWarn || !rowsInput) {
                  setRowsInput(String(layout.rows));
                  setRowsWarn(false);
                }
              }}
            />
          </label>
          {rowsWarn && <p className="mt-0.5 text-xs text-red-500">Maximum is 10</p>}
        </div>
        <div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-widest text-ink-faint">
              COLUMNS
            </span>
            <input
              type="number"
              min={1}
              max={10}
              className={inputCls}
              value={colsInput}
              onChange={handleCols}
              onBlur={() => {
                if (colsWarn || !colsInput) {
                  setColsInput(String(layout.cols));
                  setColsWarn(false);
                }
              }}
            />
          </label>
          {colsWarn && <p className="mt-0.5 text-xs text-red-500">Maximum is 10</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-hairline"
          checked={layout.includeCenterCell}
          onChange={(e) => update({ includeCenterCell: e.target.checked })}
        />
        Include center cell
      </label>

      {layout.includeCenterCell && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-widest text-ink-faint">
            CENTER CELL LABEL
          </span>
          <input
            type="text"
            className={inputCls}
            value={layout.centerCellLabel}
            onChange={(e) => update({ centerCellLabel: e.target.value })}
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold tracking-widest text-ink-faint">
          BACKGROUND IMAGE URL
        </span>
        <input
          type="url"
          className={inputCls}
          placeholder="https://example.com/map.png"
          value={layout.backgroundImageUrl}
          onChange={(e) => update({ backgroundImageUrl: e.target.value })}
        />
      </label>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main ConfigPanel
// ---------------------------------------------------------------------------

export const ConfigPanel: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const { layout, survey } = config;
  const experimental = config.experimental!;
  const expEnabled = experimental.enabled;

  // Which collapsed section is currently being edited
  const [editSection, setEditSection] = useState<1 | 2 | 3 | null>(null);

  // Collapse edit pane when experiment turns off
  useEffect(() => {
    if (!expEnabled) setEditSection(null);
  }, [expEnabled]);

  // Category chip items ↔ survey state
  const categoryItems = chipItemsFromMeta(
    survey.categoriesCsv,
    survey.categoryMeta,
    "#60a5fa",
  );

  const handleCategoryChange = (items: ChipItem[]) => {
    dispatch({
      type: "updateSurvey",
      patch: {
        categoriesCsv: items.map((i) => i.name).join(", "),
        categoryMeta: chipItemsToMeta(items),
      },
    });
  };

  // Response-label chip items ↔ experimental state
  const respLabelItems = chipItemsFromMeta(
    experimental.responseLabelsCsv,
    experimental.responseLabelMeta,
    "#8b5cf6",
  );

  const handleRespLabelChange = (items: ChipItem[]) => {
    dispatch({
      type: "updateExperimental",
      patch: {
        responseLabelsCsv: items.map((i) => i.name).join(", "),
        responseLabelMeta: chipItemsToMeta(items),
      },
    });
  };

  // Category weight helpers
  const categories = survey.categoriesCsv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const getWeight = (cat: string) =>
    experimental.weightedEntries.find((e) => e.category === cat)?.weight ?? 0;

  const setWeight = (cat: string, weight: number) => {
    const others = experimental.weightedEntries.filter((e) => e.category !== cat);
    dispatch({
      type: "updateExperimental",
      patch: {
        weightedEntries: weight > 0 ? [...others, { category: cat, weight }] : others,
      },
    });
  };

  // Seed every category to a weight of 1 the first time weighted prefill is
  // active, so the default is an even spread (weights are normalized at runtime).
  const weightCategoriesKey = categories.join("|");
  useEffect(() => {
    if (experimental.prefillMode !== "weighted" || categories.length === 0) {
      return;
    }
    const hasAny = categories.some((c) =>
      experimental.weightedEntries.some((e) => e.category === c),
    );
    if (!hasAny) {
      dispatch({
        type: "updateExperimental",
        patch: {
          weightedEntries: categories.map((category) => ({ category, weight: 1 })),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimental.prefillMode, weightCategoriesKey]);

  // Summaries for collapsed rows
  const questionSummary = `"${layout.questionText.slice(0, 38)}${
    layout.questionText.length > 38 ? "…" : ""
  }" · ${layout.rows} × ${layout.cols}`;

  const selModeSummary =
    SELECTION_MODES.find((m) => m.value === survey.selectionMode)?.label ?? "";

  const categorySummary = (
    <span className="flex items-center gap-2">
      {categoryItems.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1 text-xs text-ink-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: it.color }}
          />
          {it.name}
        </span>
      ))}
    </span>
  );

  const updateExperimental = (patch: Partial<ExperimentalConfig>) =>
    dispatch({ type: "updateExperimental", patch });

  // Paint hint for prefill mode
  const paintHint =
    experimental.prefillMode === "weighted"
      ? "Weighted mode fills every cell automatically — set the weights below."
      : experimental.prefillMode === "shuffle"
      ? "Paint a base layout in the preview; it is shuffled for each respondent."
      : "Paint cells in the preview to set the layout every respondent sees.";

  // ---------------------------------------------------------------------------
  // NON-EXPERIMENTAL state: all three sections expanded + opt-in card
  // ---------------------------------------------------------------------------

  if (!expEnabled) {
    return (
      <div className="flex flex-col gap-5">
        {/* 01 — Question & Grid */}
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <Num n="01" dim />
            <span className="font-serif text-[17px] font-semibold text-ink">
              Question &amp; grid
            </span>
          </div>
          <QuestionGridForm />
        </section>

        {/* 02 — Categories */}
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <Num n="02" dim />
            <span className="font-serif text-[17px] font-semibold text-ink">
              Categories
            </span>
          </div>
          <CategoryChips
            items={categoryItems}
            onChange={handleCategoryChange}
            addLabel="+ Add category"
            editorTitle="EDITING CATEGORY"
            showLayerMode
          />
        </section>

        {/* 03 — How respondents answer */}
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <Num n="03" dim />
            <span className="font-serif text-[17px] font-semibold text-ink">
              How respondents answer
            </span>
          </div>
          <div className="flex gap-3">
            {SELECTION_MODES.map((m) => (
              <ModeCard
                key={m.value}
                label={m.label}
                desc={m.desc}
                selected={survey.selectionMode === m.value}
                onClick={() =>
                  dispatch({ type: "updateSurvey", patch: { selectionMode: m.value } })
                }
              />
            ))}
          </div>
        </section>

        {/* 04 — Add experiment opt-in */}
        <button
          type="button"
          onClick={() => updateExperimental({ enabled: true })}
          className="flex items-center gap-4 rounded-xl border border-dashed border-[#e6cfc3] bg-paper-card px-5 py-4 text-left transition-colors hover:border-accent/60 hover:bg-accent-soft/40"
        >
          <span className="font-serif text-[33px] font-semibold leading-none text-[#c2b59c]">
            04
          </span>
          <div>
            <div className="font-serif text-[17px] font-semibold text-ink">
              Add an experiment
            </div>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Pre-fill the grid, then collect reactions from respondents.
            </p>
          </div>
          <span className="ml-auto rounded-lg border border-accent/30 bg-accent-tint px-3 py-1.5 text-xs font-bold text-accent">
            + Add
          </span>
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // EXPERIMENTAL state: 01–03 collapsed, 04 expanded
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* BASE SURVEY divider */}
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-bold tracking-widest text-ink-faint">
          BASE SURVEY
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {/* 01 */}
      <SummaryRow
        num="01"
        title="Question & grid"
        summary={questionSummary}
        expanded={editSection === 1}
        onEdit={() => setEditSection(editSection === 1 ? null : 1)}
      >
        <QuestionGridForm />
      </SummaryRow>

      {/* 02 */}
      <SummaryRow
        num="02"
        title="Categories"
        summary={categorySummary}
        expanded={editSection === 2}
        onEdit={() => setEditSection(editSection === 2 ? null : 2)}
      >
        <CategoryChips
          items={categoryItems}
          onChange={handleCategoryChange}
          addLabel="+ Add category"
          editorTitle="EDITING CATEGORY"
          showLayerMode
        />
      </SummaryRow>

      {/* 03 */}
      <SummaryRow
        num="03"
        title="How respondents answer"
        summary={selModeSummary}
        expanded={editSection === 3}
        onEdit={() => setEditSection(editSection === 3 ? null : 3)}
      >
        <div className="flex gap-3">
          {SELECTION_MODES.map((m) => (
            <ModeCard
              key={m.value}
              label={m.label}
              desc={m.desc}
              selected={survey.selectionMode === m.value}
              onClick={() =>
                dispatch({ type: "updateSurvey", patch: { selectionMode: m.value } })
              }
            />
          ))}
        </div>
      </SummaryRow>

      {/* THE EXPERIMENT divider */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="text-[11px] font-bold tracking-widest text-accent">
          THE EXPERIMENT
        </span>
        <span className="h-px flex-1 bg-[#e6cfc3]" />
        <button
          type="button"
          onClick={() => updateExperimental({ enabled: false })}
          className="text-xs font-bold text-ink-faint hover:text-ink"
        >
          Remove experiment
        </button>
      </div>

      {/* 04 — Experiment config */}
      <div className="rounded-xl border border-[#e6cfc3] bg-paper-card p-5">
        <div className="mb-5 flex items-baseline gap-4">
          <Num n="04" />
          <div>
            <div className="font-serif text-[19px] font-semibold text-ink">
              Experiment
            </div>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Pre-fill the grid, then collect reactions from respondents.
            </p>
          </div>
        </div>

        {/* Pre-fill mode cards */}
        <label className="mb-2.5 block text-[11px] font-bold tracking-widest text-ink-faint">
          PRE-FILL MODE
        </label>
        <div className="flex gap-3">
          {PREFILL_MODES.map((m) => (
            <ModeCard
              key={m.value}
              label={m.label}
              desc={m.desc}
              selected={experimental.prefillMode === m.value}
              onClick={() => updateExperimental({ prefillMode: m.value })}
            />
          ))}
        </div>

        <p className="mt-3 rounded-lg border border-hairline-warm bg-paper-window px-3 py-2.5 text-[12.5px] text-ink-muted">
          {paintHint}
        </p>

        {/* Category weights (weighted mode only) */}
        {experimental.prefillMode === "weighted" && categories.length > 0 && (
          <div className="mt-4">
            <label className="mb-2.5 block text-[11px] font-bold tracking-widest text-ink-faint">
              CATEGORY WEIGHTS{" "}
              <span className="font-medium text-[#c2b59c]">normalized automatically</span>
            </label>
            <div className="flex flex-col gap-2">
              {categories.map((cat) => {
                const color = survey.categoryMeta[cat]?.color ?? "#60a5fa";
                const w = getWeight(cat);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="flex-1 text-[13.5px] text-ink">{cat}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={w === 0 ? "" : w}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") { setWeight(cat, 0); return; }
                        const n = Number(raw);
                        if (!Number.isNaN(n)) setWeight(cat, Math.max(0, n));
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-20 rounded-lg border border-hairline bg-white px-3 py-1.5 text-right font-mono text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                    />
                  </div>
                );
              })}
              {experimental.weightedEntries.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Set at least one weight above — otherwise all cells will be empty.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Response labels */}
        <div className="mt-5 border-t border-hairline pt-4">
          <label className="mb-1 block text-[11px] font-bold tracking-widest text-ink-faint">
            RESPONSE LABELS
          </label>
          <p className="mb-3 text-[12.5px] text-ink-muted">
            The reactions respondents place on pre-filled cells.
          </p>
          <CategoryChips
            items={respLabelItems}
            onChange={handleRespLabelChange}
            addLabel="+ Add label"
            editorTitle="EDITING LABEL"
            showLayerMode
          />
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
