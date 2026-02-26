import React from "react";
import { useEditor } from "../EditorContext";

const numberOrNull = (value: string): number | null =>
  value === "" ? null : Number(value);

export const LayoutTab: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const layout = config.layout;

  const updateLayout = (patch: Partial<typeof layout>) => {
    dispatch({ type: "updateLayout", patch });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1">
        <span className="font-medium">Question text</span>
        <textarea
          className="min-h-[96px] rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={layout.questionText}
          onChange={(e) => updateLayout({ questionText: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Rows</span>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            value={layout.rows}
            onChange={(e) => updateLayout({ rows: Number(e.target.value) })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Columns</span>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            value={layout.cols}
            onChange={(e) => updateLayout({ cols: Number(e.target.value) })}
          />
        </label>
      </div>

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Center cell
        </legend>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={layout.includeCenterCell}
            onChange={(e) =>
              updateLayout({ includeCenterCell: e.target.checked })
            }
          />
          Include labeled cell
        </label>

        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Cell label</span>
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={layout.centerCellLabel}
              onChange={(e) =>
                updateLayout({ centerCellLabel: e.target.value })
              }
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Center row{" "}
                <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                type="number"
                min={1}
                max={layout.rows || 1}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={layout.centerRow ?? ""}
                onChange={(e) =>
                  updateLayout({ centerRow: numberOrNull(e.target.value) })
                }
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Center column{" "}
                <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                type="number"
                min={1}
                max={layout.cols || 1}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                value={layout.centerCol ?? ""}
                onChange={(e) =>
                  updateLayout({ centerCol: numberOrNull(e.target.value) })
                }
              />
            </label>
          </div>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Background image URL</span>
        <input
          type="url"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="https://example.com/map.png"
          value={layout.backgroundImageUrl}
          onChange={(e) =>
            updateLayout({ backgroundImageUrl: e.target.value })
          }
        />
      </label>
    </form>
  );
};

export default LayoutTab;

