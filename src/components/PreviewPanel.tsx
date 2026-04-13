import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";
import { SelectionMode } from "../grid-types";
import { buildQualtricsSnippet } from "../lib/qualtricsExport";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSelectionModeLabel(mode: SelectionMode): string {
  switch (mode) {
    case "dropdown":
      return "Dropdown per cell";
    case "dragdrop":
      return "Drag and drop";
    case "paint":
    default:
      return "Select then click";
  }
}

function renderAssignedContent(category: string, imageUrl: string) {
  return (
    <>
      {imageUrl && (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-0.5">
          <img
            src={imageUrl}
            alt={category}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
      <div
        className={`w-full flex-shrink-0 text-center leading-tight ${
          imageUrl
            ? "truncate px-0.5 pb-0.5 text-[9px]"
            : "flex flex-1 items-center justify-center p-1 text-[10px]"
        }`}
      >
        {category}
      </div>
    </>
  );
}

export const PreviewPanel: React.FC = () => {
  const {
    state: { config },
  } = useEditor();

  const { layout, tuning, survey } = config;

  const categories = useMemo(
    () =>
      survey.categoriesCsv
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    [survey.categoriesCsv],
  );

  const [copied, setCopied] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  useEffect(() => {
    if (!categories.length) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? null);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    setAssignments({});
    setDraggedCategory(null);
    setDragOverCell(null);
  }, [config.id, survey.selectionMode, survey.categoriesCsv]);

  const totalCells = layout.rows * layout.cols;
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const row = Math.floor(index / layout.cols) + 1;
    const col = (index % layout.cols) + 1;

    const centerRow = layout.centerRow ?? Math.ceil(layout.rows / 2);
    const centerCol = layout.centerCol ?? Math.ceil(layout.cols / 2);

    const isCenter =
      layout.includeCenterCell && row === centerRow && col === centerCol;

    return { row, col, isCenter, key: `${row}-${col}` };
  });

  const lockedCellKeys = useMemo(
    () => new Set(cells.filter((cell) => cell.isCenter).map((cell) => cell.key)),
    [cells],
  );

  const applyAssignment = (key: string, category: string | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (!category) {
        delete next[key];
      } else {
        next[key] = category;
      }
      return next;
    });
  };

  const handlePaintCellClick = (key: string) => {
    if (
      !survey.allowInteraction ||
      survey.selectionMode !== "paint" ||
      !activeCategory ||
      lockedCellKeys.has(key)
    ) {
      return;
    }

    setAssignments((prev) => {
      const current = prev[key];
      const next = { ...prev };
      if (current === activeCategory) {
        delete next[key];
      } else {
        next[key] = activeCategory;
      }
      return next;
    });
  };

  const qualtricsSnippet = useMemo(() => buildQualtricsSnippet(config), [config]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qualtricsSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <section
        aria-label="Grid preview"
        className="flex h-full min-h-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:overflow-hidden"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Live preview</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              {layout.rows} × {layout.cols}
            </span>
            {survey.allowInteraction && categories.length > 0 && (
              <span>{getSelectionModeLabel(survey.selectionMode)}</span>
            )}
          </div>
        </header>

        {survey.allowInteraction &&
          categories.length > 0 &&
          survey.selectionMode === "paint" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Placing:</span>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => {
                  const color = survey.categoryMeta[cat]?.color ?? "#60a5fa";
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                        activeCategory === cat
                          ? "shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      style={
                        activeCategory === cat
                          ? {
                              borderColor: color,
                              backgroundColor: hexToRgba(color, 0.1),
                              color: "#0f172a",
                            }
                          : {}
                      }
                    >
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {survey.allowInteraction &&
          categories.length > 0 &&
          survey.selectionMode === "dragdrop" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">
                Drag a label onto a cell:
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const color = survey.categoryMeta[cat]?.color ?? "#60a5fa";
                  return (
                    <button
                      key={cat}
                      type="button"
                      draggable
                      onDragStart={() => setDraggedCategory(cat)}
                      onDragEnd={() => {
                        setDraggedCategory(null);
                        setDragOverCell(null);
                      }}
                      className="rounded-full border px-3 py-1 text-xs font-medium text-slate-700"
                      style={{
                        borderColor: color,
                        backgroundColor: hexToRgba(color, 0.12),
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDraggedCategory("__CLEAR__")}
                  onDragEnd={() => {
                    setDraggedCategory(null);
                    setDragOverCell(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                >
                  Clear cell
                </button>
              </div>
            </div>
          )}

        {survey.allowInteraction &&
          categories.length > 0 &&
          survey.selectionMode === "dropdown" && (
            <p className="text-xs text-slate-500">
              Each cell gets its own dropdown so respondents have to make a deliberate choice.
            </p>
          )}

        <p className="text-sm text-slate-700">{layout.questionText}</p>

        <div
          className="relative min-h-0 w-full flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
          style={{
            width: "100%",
            aspectRatio: `${tuning.previewWidth} / ${tuning.previewHeight}`,
            backgroundImage: layout.backgroundImageUrl
              ? `url(${layout.backgroundImageUrl})`
              : undefined,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "contain",
          }}
        >
          <div
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
              gap: tuning.gridGap,
              padding: tuning.gridPadding,
            }}
          >
            {cells.map((cell) => {
              const assignedCat = assignments[cell.key];
              const catMeta = assignedCat ? survey.categoryMeta[assignedCat] : null;
              const catColor = catMeta?.color ?? "#60a5fa";
              const catImage = catMeta?.imageUrl ?? "";
              const isDropTarget =
                survey.selectionMode === "dragdrop" && dragOverCell === cell.key;

              return (
                <div
                  key={cell.key}
                  onClick={() => handlePaintCellClick(cell.key)}
                  onDragOver={(e) => {
                    if (!survey.allowInteraction || survey.selectionMode !== "dragdrop") {
                      return;
                    }
                    e.preventDefault();
                    setDragOverCell(cell.key);
                  }}
                  onDragLeave={() => {
                    if (
                      survey.selectionMode === "dragdrop" &&
                      dragOverCell === cell.key
                    ) {
                      setDragOverCell(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (
                      !survey.allowInteraction ||
                      survey.selectionMode !== "dragdrop" ||
                      cell.isCenter
                    ) {
                      return;
                    }
                    e.preventDefault();
                    const droppedCategory =
                      draggedCategory ?? e.dataTransfer.getData("text/plain");
                    if (!droppedCategory) {
                      setDragOverCell(null);
                      return;
                    }
                    applyAssignment(
                      cell.key,
                      droppedCategory === "__CLEAR__" ? null : droppedCategory,
                    );
                    setDragOverCell(null);
                    setDraggedCategory(null);
                  }}
                  className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border font-medium ${
                    survey.allowInteraction &&
                    survey.selectionMode === "paint" &&
                    !cell.isCenter
                      ? "cursor-pointer transition-colors"
                      : ""
                  }`}
                  style={
                    assignedCat
                      ? {
                          backgroundColor: hexToRgba(catColor, 0.2),
                          borderColor: catColor,
                          color: "#0f172a",
                        }
                      : isDropTarget
                        ? {
                            backgroundColor: "#e2e8f0",
                            borderColor: "#0f172a",
                            color: "#0f172a",
                          }
                        : cell.isCenter
                          ? {
                              backgroundColor: "#f0f9ff",
                              borderColor: "#38bdf8",
                              color: "#0f172a",
                            }
                          : {
                              backgroundColor: "#ffffff",
                              borderColor: "#cbd5e1",
                              color: "#1e293b",
                            }
                  }
                >
                  {assignedCat ? (
                    renderAssignedContent(assignedCat, catImage)
                  ) : survey.allowInteraction &&
                    survey.selectionMode === "dropdown" &&
                    !cell.isCenter ? (
                    <div className="flex h-full flex-col justify-center gap-1 p-1">
                      <select
                        aria-label={`Choose label for row ${cell.row} column ${cell.col}`}
                        value={assignments[cell.key] ?? ""}
                        onChange={(e) =>
                          applyAssignment(cell.key, e.target.value || null)
                        }
                        className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] text-slate-900 outline-none focus:border-sky-500"
                      >
                        <option value="">Choose label</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : cell.isCenter ? (
                    <div className="flex flex-1 items-center justify-center p-1">
                      <span className="w-full break-words text-center text-[10px] leading-tight">
                        {layout.centerCellLabel || "Your House"}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsCodeModalOpen(true)}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Export to Qualtrics
          </button>
        </div>
      </section>

      {isCodeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Qualtrics JavaScript"
          onClick={() => setIsCodeModalOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  Export to Qualtrics
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Close
                </button>
              </div>
            </header>
            <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 lg:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="min-h-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <span className="font-mono text-base">{`</>`}</span>
                      <span>Code</span>
                    </div>
                  </div>
                  <textarea
                    className="h-[52vh] w-full resize-none rounded-xl border border-slate-200 bg-slate-950/90 p-3 font-mono text-[11px] text-slate-50 shadow-inner"
                    readOnly
                    value={qualtricsSnippet}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              </div>
              <aside className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <h4 className="text-sm font-semibold">Qualtrics setup</h4>
                <ol className="flex flex-col gap-2">
                  <li>
                    In Qualtrics, open <strong>Survey</strong>, then <strong>Survey Flow</strong>.
                  </li>
                  <li>
                    Add an <strong>Embedded Data</strong> element before this question.
                  </li>
                  <li>
                    Create a field named{" "}
                    <code className="rounded bg-amber-100 px-1 font-mono font-bold">
                      GridAssignments
                    </code>{" "}
                    and leave it blank.
                  </li>
                  <li>
                    Go back to the question, open <strong>JavaScript</strong> under question behavior, and paste the code.
                  </li>
                  <li>
                    Export results from <strong>Data &amp; Analysis</strong>. Responses are saved as JSON like{" "}
                    <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Dwarves"}`}</code>.
                  </li>
                </ol>
                <p>
                  If you have multiple grid questions, rename the embedded field to something unique like{" "}
                  <code className="rounded bg-amber-100 px-1 font-mono">GridAssignments_Q2</code>
                  .
                </p>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PreviewPanel;
