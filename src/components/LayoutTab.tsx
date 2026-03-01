import React, { useState } from "react";
import { useEditor } from "../EditorContext";

export const LayoutTab: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const layout = config.layout;

  const [rowsInput, setRowsInput] = useState(String(layout.rows));
  const [colsInput, setColsInput] = useState(String(layout.cols));
  const [centerRowInput, setCenterRowInput] = useState(layout.centerRow != null ? String(layout.centerRow) : "");
  const [centerColInput, setCenterColInput] = useState(layout.centerCol != null ? String(layout.centerCol) : "");
  const [rowsWarning, setRowsWarning] = useState(false);
  const [colsWarning, setColsWarning] = useState(false);
  const [centerRowWarning, setCenterRowWarning] = useState(false);
  const [centerColWarning, setCenterColWarning] = useState(false);

  const updateLayout = (patch: Partial<typeof layout>) => {
    dispatch({ type: "updateLayout", patch });
  };

  const handleRowsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRowsInput(raw);
    if (raw === "") return;
    const val = Number(raw);
    if (val > 10) {
      setRowsWarning(true);
    } else {
      setRowsWarning(false);
      updateLayout({ rows: val });
    }
  };

  const handleRowsBlur = () => {
    if (rowsInput === "" || Number(rowsInput) < 1 || rowsWarning) {
      setRowsInput(String(layout.rows));
      setRowsWarning(false);
    }
  };

  const handleColsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setColsInput(raw);
    if (raw === "") return;
    const val = Number(raw);
    if (val > 10) {
      setColsWarning(true);
    } else {
      setColsWarning(false);
      updateLayout({ cols: val });
    }
  };

  const handleColsBlur = () => {
    if (colsInput === "" || Number(colsInput) < 1 || colsWarning) {
      setColsInput(String(layout.cols));
      setColsWarning(false);
    }
  };

  const handleCenterRowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCenterRowInput(raw);
    if (raw === "") {
      setCenterRowWarning(false);
      updateLayout({ centerRow: null });
      return;
    }
    const val = Number(raw);
    const max = layout.rows || 1;
    if (val > max) {
      setCenterRowWarning(true);
    } else {
      setCenterRowWarning(false);
      updateLayout({ centerRow: val });
    }
  };

  const handleCenterColChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCenterColInput(raw);
    if (raw === "") {
      setCenterColWarning(false);
      updateLayout({ centerCol: null });
      return;
    }
    const val = Number(raw);
    const max = layout.cols || 1;
    if (val > max) {
      setCenterColWarning(true);
    } else {
      setCenterColWarning(false);
      updateLayout({ centerCol: val });
    }
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
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Rows</span>
            <input
              type="number"
              min={1}
              max={10}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={rowsInput}
              onChange={handleRowsChange}
              onBlur={handleRowsBlur}
            />
          </label>
          {rowsWarning && (
            <span className="text-xs text-red-500">Maximum is 10</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Columns</span>
            <input
              type="number"
              min={1}
              max={10}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={colsInput}
              onChange={handleColsChange}
              onBlur={handleColsBlur}
            />
          </label>
          {colsWarning && (
            <span className="text-xs text-red-500">Maximum is 10</span>
          )}
        </div>
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
            <div className="flex flex-col gap-1">
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
                  value={centerRowInput}
                  onChange={handleCenterRowChange}
                />
              </label>
              {centerRowWarning && (
                <span className="text-xs text-red-500">
                  Max is {layout.rows}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
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
                  value={centerColInput}
                  onChange={handleCenterColChange}
                />
              </label>
              {centerColWarning && (
                <span className="text-xs text-red-500">
                  Max is {layout.cols}
                </span>
              )}
            </div>
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

