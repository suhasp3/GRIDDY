import React from "react";
import { useEditor } from "../EditorContext";
import { ExperimentalConfig } from "../grid-types";

const selectionModeOptions = [
  {
    value: "paint",
    label: "Select then click",
    description: "Pick a label first, then click cells to place or remove it.",
  },
  {
    value: "dropdown",
    label: "Dropdown per cell",
    description: "Each cell gets its own dropdown so every choice is explicit.",
  },
  {
    value: "dragdrop",
    label: "Drag and drop",
    description: "Drag labels onto cells for a slower, more intentional flow.",
  },
] as const;

export const SurveyTab: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const survey = config.survey;
  const experimental = config.experimental!;

  const updateSurvey = (patch: Partial<typeof survey>) => {
    dispatch({ type: "updateSurvey", patch });
  };

  const updateExperimental = (patch: Partial<ExperimentalConfig>) => {
    dispatch({ type: "updateExperimental", patch });
  };

  const categories = survey.categoriesCsv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const getWeight = (cat: string) =>
    experimental.weightedEntries.find((e) => e.category === cat)?.weight ?? 0;

  const setWeight = (cat: string, weight: number) => {
    const others = experimental.weightedEntries.filter((e) => e.category !== cat);
    updateExperimental({
      weightedEntries: weight > 0 ? [...others, { category: cat, weight }] : others,
    });
  };

  const handleWeightChange = (cat: string, value: string) => {
    if (value === "") {
      setWeight(cat, 0);
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setWeight(cat, Math.max(0, parsed));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* --- Mode toggle --- */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-800">
          {experimental.enabled ? "Experimental mode" : "Standard mode"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={experimental.enabled}
          onClick={() => updateExperimental({ enabled: !experimental.enabled })}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            experimental.enabled ? "bg-violet-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              experimental.enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* --- Standard mode settings --- */}
      {!experimental.enabled && (
        <>
          <fieldset className="rounded-md border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-700">
                Selection mode
              </legend>
              <div className="mt-2 flex flex-col gap-2">
                {selectionModeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      value={option.value}
                      checked={survey.selectionMode === option.value}
                      onChange={() =>
                        updateSurvey({ selectionMode: option.value })
                      }
                      className="mt-1 h-4 w-4 border-slate-300"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-slate-800">
                        {option.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
        </>
      )}

      {/* --- Experimental mode settings --- */}
      {experimental.enabled && (
        <>
          <fieldset className="rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Pre-fill mode
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  {
                    value: "fixed",
                    label: "Fixed",
                    description:
                      "Every respondent sees the same layout you paint in the Setup tab.",
                  },
                  {
                    value: "shuffle",
                    label: "Shuffle",
                    description:
                      "Your painted assignments are randomly shuffled for each respondent.",
                  },
                  {
                    value: "weighted",
                    label: "Weighted",
                    description:
                      "Each cell is independently filled by sampling from the weights you set below.",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="prefillMode"
                    value={opt.value}
                    checked={experimental.prefillMode === opt.value}
                    onChange={() => updateExperimental({ prefillMode: opt.value })}
                    className="mt-1 h-4 w-4 border-slate-300"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-800">
                      {opt.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {opt.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {(experimental.prefillMode === "fixed" ||
            experimental.prefillMode === "shuffle") && (
            <p className="text-xs text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
              Use the <strong>Setup</strong> tab in the preview panel to paint
              cell assignments.
              {experimental.prefillMode === "shuffle" &&
                " At runtime the assignments will be shuffled per respondent."}
            </p>
          )}

          {experimental.prefillMode === "weighted" && categories.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Category weights
              </span>
              <p className="text-xs text-slate-500">
                Weights don't need to sum to 100 — they're normalized automatically.
              </p>
              {categories.map((cat) => {
                const meta = survey.categoryMeta[cat];
                const color = meta?.color ?? "#60a5fa";
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm flex-1 truncate">{cat}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={getWeight(cat) === 0 ? "" : getWeight(cat)}
                      onChange={(e) => handleWeightChange(cat, e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-right shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                );
              })}
              {experimental.weightedEntries.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Set at least one weight above — otherwise all cells will be empty.
                </p>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-medium text-sm">
              Response labels (comma separated)
            </span>
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              placeholder="Good, Neutral, Bad"
              value={experimental.responseLabelsCsv}
              onChange={(e) =>
                updateExperimental({ responseLabelsCsv: e.target.value })
              }
            />
            <p className="text-xs text-slate-500">
              These appear as a dropdown in each pre-filled cell for respondents to react.
            </p>
          </label>
        </>
      )}

      {/* --- Categories (shared by both modes) --- */}
      <label className="flex flex-col gap-1">
        <span className="font-medium text-sm">
          Categories (comma separated)
        </span>
        <input
          type="text"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Dwarves, Elves, Hobbits, Rohirrim"
          value={survey.categoriesCsv}
          onChange={(e) => updateSurvey({ categoriesCsv: e.target.value })}
        />
        <p className="text-xs text-slate-500">
          {experimental.enabled
            ? "These are the labels used to pre-fill cells."
            : "These become the options participants can place on the grid."}{" "}
          Use a comma to separate each label.
        </p>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={survey.advancedCategories}
          onChange={(e) =>
            updateSurvey({ advancedCategories: e.target.checked })
          }
        />
        <span className="font-medium">Category Colors and Images</span>
      </label>

      {survey.advancedCategories && categories.length > 0 && (
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const meta = survey.categoryMeta[cat] ?? {
              color: "#60a5fa",
              imageUrl: "",
            };
            return (
              <div
                key={cat}
                className="rounded-md border border-slate-200 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-sm font-medium">{cat}</span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Color
                    <input
                      type="color"
                      value={meta.color}
                      onChange={(e) =>
                        updateSurvey({
                          categoryMeta: {
                            ...survey.categoryMeta,
                            [cat]: { ...meta, color: e.target.value },
                          },
                        })
                      }
                      className="h-7 w-10 cursor-pointer rounded border border-slate-300 p-0.5"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Image URL
                  <input
                    type="url"
                    placeholder="https://example.com/image.png"
                    value={meta.imageUrl}
                    onChange={(e) =>
                      updateSurvey({
                        categoryMeta: {
                          ...survey.categoryMeta,
                          [cat]: { ...meta, imageUrl: e.target.value },
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
};

export default SurveyTab;
