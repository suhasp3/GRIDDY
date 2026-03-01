import React from "react";
import { useEditor } from "../EditorContext";

export const SurveyTab: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const survey = config.survey;

  const updateSurvey = (patch: Partial<typeof survey>) => {
    dispatch({ type: "updateSurvey", patch });
  };

  const categories = survey.categoriesCsv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={survey.allowInteraction}
          onChange={(e) =>
            updateSurvey({ allowInteraction: e.target.checked })
          }
        />
        <span>
          <span className="font-medium">Allow participant interaction</span>{" "}
          <span className="text-slate-500">
            (uncheck for static experimental grid)
          </span>
        </span>
      </label>

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
          These become the options participants can place on the grid. Use a
          comma to separate each label.
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
        <span className="font-medium">Advanced category customization</span>
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
