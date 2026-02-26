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
    </form>
  );
};

export default SurveyTab;

