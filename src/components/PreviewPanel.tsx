import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";
import { SelectionMode, WeightEntry } from "../grid-types";
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

// --- Experimental utility functions ---

interface CellInfo {
  row: number;
  col: number;
  isCenter: boolean;
  key: string;        // ephemeral key: "row-col"
  exportKey: string;  // persistent key: "rRow-cCol"
}

function computeShuffle(
  fixedAssignments: Record<string, string>,
  cells: CellInfo[],
): Record<string, string> {
  const nonCenterKeys = cells.filter((c) => !c.isCenter).map((c) => c.exportKey);
  const assignedKeys = nonCenterKeys.filter((k) => fixedAssignments[k]);
  const values = assignedKeys.map((k) => fixedAssignments[k]);

  // Fisher-Yates shuffle
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const result: Record<string, string> = { ...fixedAssignments };
  assignedKeys.forEach((key, idx) => {
    result[key] = shuffled[idx];
  });
  return result;
}

function computeWeightedSample(
  weightedEntries: WeightEntry[],
  cells: CellInfo[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const totalWeight = weightedEntries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight === 0 || weightedEntries.length === 0) return result;

  // Build CDF
  let cum = 0;
  const cdf = weightedEntries.map((e) => {
    cum += e.weight / totalWeight;
    return { category: e.category, cumulative: cum };
  });

  for (const cell of cells) {
    if (cell.isCenter) continue;
    const rand = Math.random();
    const picked = cdf.find((entry) => rand <= entry.cumulative);
    if (picked) result[cell.exportKey] = picked.category;
  }
  return result;
}

// --- Main component ---

export const PreviewPanel: React.FC = () => {
  const {
    state: { config },
    dispatch,
  } = useEditor();

  const { layout, tuning, survey } = config;
  const experimental = config.experimental!;
  const expEnabled = experimental.enabled;

  const categories = useMemo(
    () =>
      survey.categoriesCsv
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    [survey.categoriesCsv],
  );

  const responseLabels = useMemo(
    () =>
      experimental.responseLabelsCsv
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    [experimental.responseLabelsCsv],
  );

  const [copied, setCopied] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeResponseLabel, setActiveResponseLabel] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedResponseLabel, setDraggedResponseLabel] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Experimental mode state
  const [experimentalTab, setExperimentalTab] = useState<"setup" | "respondent">("setup");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [weightedPreview, setWeightedPreview] = useState<Record<string, string>>({});
  const [shuffleSnapshot, setShuffleSnapshot] = useState<Record<string, string>>({});

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
    if (!responseLabels.length) {
      setActiveResponseLabel(null);
      return;
    }
    if (!activeResponseLabel || !responseLabels.includes(activeResponseLabel)) {
      setActiveResponseLabel(responseLabels[0] ?? null);
    }
  }, [responseLabels, activeResponseLabel]);

  useEffect(() => {
    setAssignments({});
    setDraggedCategory(null);
    setDragOverCell(null);
    setResponses({});
    setShuffleSnapshot({});
    setWeightedPreview({});
    setExperimentalTab("setup");
  }, [config.id, survey.selectionMode, survey.categoriesCsv]);

  const totalCells = layout.rows * layout.cols;
  const cells: CellInfo[] = useMemo(
    () =>
      Array.from({ length: totalCells }, (_, index) => {
        const row = Math.floor(index / layout.cols) + 1;
        const col = (index % layout.cols) + 1;
        const centerRow = layout.centerRow ?? Math.ceil(layout.rows / 2);
        const centerCol = layout.centerCol ?? Math.ceil(layout.cols / 2);
        const isCenter =
          layout.includeCenterCell && row === centerRow && col === centerCol;
        return {
          row,
          col,
          isCenter,
          key: `${row}-${col}`,
          exportKey: `r${row}-c${col}`,
        };
      }),
    [totalCells, layout],
  );

  const lockedCellKeys = useMemo(
    () => new Set(cells.filter((cell) => cell.isCenter).map((cell) => cell.key)),
    [cells],
  );

  // Generate weighted preview whenever entries or cells change
  useEffect(() => {
    if (expEnabled && experimental.prefillMode === "weighted") {
      setWeightedPreview(computeWeightedSample(experimental.weightedEntries, cells));
    }
  }, [expEnabled, experimental.prefillMode, experimental.weightedEntries, cells]);

  // Derive what to display in cells
  const displayAssignments = useMemo<Record<string, string>>(() => {
    if (!expEnabled) return assignments;
    if (experimentalTab === "setup") {
      if (experimental.prefillMode === "weighted") return weightedPreview;
      return experimental.fixedAssignments;
    }
    // respondent tab
    if (experimental.prefillMode === "shuffle") return shuffleSnapshot;
    if (experimental.prefillMode === "weighted") return weightedPreview;
    return experimental.fixedAssignments;
  }, [
    expEnabled,
    experimentalTab,
    experimental.prefillMode,
    experimental.fixedAssignments,
    assignments,
    weightedPreview,
    shuffleSnapshot,
  ]);

  const applyAssignment = useCallback(
    (exportKey: string, ephemeralKey: string, category: string | null) => {
      if (
        expEnabled &&
        experimentalTab === "setup" &&
        experimental.prefillMode !== "weighted"
      ) {
        // Persist to config
        const next = { ...experimental.fixedAssignments };
        if (!category) {
          delete next[exportKey];
        } else {
          next[exportKey] = category;
        }
        dispatch({ type: "updateExperimental", patch: { fixedAssignments: next } });
      } else {
        setAssignments((prev) => {
          const next = { ...prev };
          if (!category) {
            delete next[ephemeralKey];
          } else {
            next[ephemeralKey] = category;
          }
          return next;
        });
      }
    },
    [expEnabled, experimentalTab, experimental.prefillMode, experimental.fixedAssignments, dispatch],
  );

  const applyResponse = useCallback((exportKey: string, label: string | null) => {
    setResponses((prev) => {
      const next = { ...prev };
      if (!label) {
        delete next[exportKey];
      } else {
        next[exportKey] = label;
      }
      return next;
    });
  }, []);

  const handlePaintCellClick = (cell: CellInfo) => {
    if (expEnabled && experimentalTab === "respondent") return;
    if (
      (!expEnabled && (!survey.allowInteraction || survey.selectionMode !== "paint")) ||
      !activeCategory ||
      lockedCellKeys.has(cell.key)
    ) {
      return;
    }
    if (expEnabled && experimental.prefillMode !== "weighted") {
      // Experimental setup: toggle in fixedAssignments
      const current = experimental.fixedAssignments[cell.exportKey];
      applyAssignment(
        cell.exportKey,
        cell.key,
        current === activeCategory ? null : activeCategory,
      );
    } else if (!expEnabled) {
      setAssignments((prev) => {
        const current = prev[cell.key];
        const next = { ...prev };
        if (current === activeCategory) {
          delete next[cell.key];
        } else {
          next[cell.key] = activeCategory;
        }
        return next;
      });
    }
  };

  const switchToRespondent = () => {
    if (experimental.prefillMode === "shuffle") {
      setShuffleSnapshot(computeShuffle(experimental.fixedAssignments, cells));
    }
    setResponses({});
    setExperimentalTab("respondent");
  };

  const regenerateWeighted = () => {
    setWeightedPreview(computeWeightedSample(experimental.weightedEntries, cells));
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

  // Toolbar visibility
  const showPaintToolbar =
    (!expEnabled && survey.allowInteraction && categories.length > 0 && survey.selectionMode === "paint") ||
    (expEnabled && experimentalTab === "setup" && experimental.prefillMode !== "weighted" && categories.length > 0) ||
    (expEnabled && experimentalTab === "respondent" && responseLabels.length > 0 && survey.selectionMode === "paint");

  const showDragDropToolbar =
    (!expEnabled && survey.allowInteraction && categories.length > 0 && survey.selectionMode === "dragdrop") ||
    (expEnabled && experimentalTab === "respondent" && responseLabels.length > 0 && survey.selectionMode === "dragdrop");

  const showDropdownHint =
    (!expEnabled && survey.allowInteraction && categories.length > 0 && survey.selectionMode === "dropdown") ||
    (expEnabled && experimentalTab === "respondent" && responseLabels.length > 0 && survey.selectionMode === "dropdown");

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
            {!expEnabled && survey.allowInteraction && categories.length > 0 && (
              <span>{getSelectionModeLabel(survey.selectionMode)}</span>
            )}
            {expEnabled && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                Experimental
              </span>
            )}
          </div>
        </header>

        {/* Experimental Setup / Respondent tab toggle */}
        {expEnabled && (
          <div className="inline-flex self-start items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setExperimentalTab("setup")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                experimentalTab === "setup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/60"
              }`}
            >
              Setup
            </button>
            <button
              type="button"
              onClick={switchToRespondent}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                experimentalTab === "respondent"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/60"
              }`}
            >
              Respondent Preview
            </button>
          </div>
        )}

        {/* Weighted mode: regenerate button in setup tab */}
        {expEnabled &&
          experimentalTab === "setup" &&
          experimental.prefillMode === "weighted" && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500 flex-1">
                Sample preview — each respondent gets an independent draw.
              </p>
              <button
                type="button"
                onClick={regenerateWeighted}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-3.5 w-3.5"
                >
                  <path
                    d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16.25 4.58v3.34h-3.33"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Regenerate
              </button>
            </div>
          )}

        {/* Paint toolbar */}
        {showPaintToolbar && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {expEnabled && experimentalTab === "respondent" ? "Reacting:" : "Placing:"}
            </span>
            <div className="flex flex-wrap gap-1">
              {(expEnabled && experimentalTab === "respondent" ? responseLabels : categories).map((item) => {
                const isRespTab = expEnabled && experimentalTab === "respondent";
                const color = isRespTab
                  ? (experimental.responseLabelMeta?.[item]?.color ?? "#8b5cf6")
                  : (survey.categoryMeta[item]?.color ?? "#60a5fa");
                const isActive = isRespTab ? activeResponseLabel === item : activeCategory === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => isRespTab ? setActiveResponseLabel(item) : setActiveCategory(item)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                      isActive
                        ? "shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    style={
                      isActive
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
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Drag-drop toolbar */}
        {showDragDropToolbar && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-600">
              {expEnabled && experimentalTab === "respondent"
                ? "Drag a reaction onto a cell:"
                : "Drag a label onto a cell:"}
            </span>
            <div className="flex flex-wrap gap-2">
              {(expEnabled && experimentalTab === "respondent" ? responseLabels : categories).map((item) => {
                const isRespTab = expEnabled && experimentalTab === "respondent";
                const color = isRespTab
                  ? (experimental.responseLabelMeta?.[item]?.color ?? "#8b5cf6")
                  : (survey.categoryMeta[item]?.color ?? "#60a5fa");
                return (
                  <button
                    key={item}
                    type="button"
                    draggable
                    onDragStart={() =>
                      isRespTab ? setDraggedResponseLabel(item) : setDraggedCategory(item)
                    }
                    onDragEnd={() => {
                      if (isRespTab) setDraggedResponseLabel(null);
                      else setDraggedCategory(null);
                      setDragOverCell(null);
                    }}
                    className="rounded-full border px-3 py-1 text-xs font-medium text-slate-700"
                    style={{
                      borderColor: color,
                      backgroundColor: hexToRgba(color, 0.12),
                    }}
                  >
                    {item}
                  </button>
                );
              })}
              {expEnabled && experimentalTab === "respondent" ? (
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDraggedResponseLabel("__CLEAR_RESP__")}
                  onDragEnd={() => {
                    setDraggedResponseLabel(null);
                    setDragOverCell(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                >
                  Clear response
                </button>
              ) : (
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
              )}
            </div>
          </div>
        )}

        {/* Dropdown hint */}
        {showDropdownHint && (
          <p className="text-xs text-slate-500">
            Each cell gets its own dropdown so respondents have to make a deliberate choice.
          </p>
        )}

        {/* Experimental respondent hint */}
        {expEnabled && experimentalTab === "respondent" && responseLabels.length === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            No response labels defined — add them in the Survey tab under Experimental Mode.
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
              // For experimental mode use exportKey for lookup, else use key
              const lookupKey = expEnabled ? cell.exportKey : cell.key;
              const assignedCat = displayAssignments[lookupKey];
              const catMeta = assignedCat ? survey.categoryMeta[assignedCat] : null;
              const catColor = catMeta?.color ?? "#60a5fa";
              const catImage = catMeta?.imageUrl ?? "";
              const isDropTarget =
                !expEnabled &&
                survey.selectionMode === "dragdrop" &&
                dragOverCell === cell.key;

              // Experimental respondent view
              if (expEnabled && experimentalTab === "respondent" && !cell.isCenter) {
                const selectedResponse = responses[cell.exportKey] ?? "";
                const respMeta = selectedResponse
                  ? (experimental.responseLabelMeta?.[selectedResponse] ?? null)
                  : null;
                const respColor = respMeta?.color ?? "#8b5cf6";
                const respImage = respMeta?.imageUrl ?? "";
                const hasResponse = Boolean(selectedResponse);
                const isRespDropTarget =
                  survey.selectionMode === "dragdrop" && dragOverCell === cell.key;
                const isInteractive = survey.selectionMode !== "dropdown";

                return (
                  <div
                    key={cell.key}
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md font-medium transition-colors${
                      hasResponse ? " border-2" : " border"
                    }${isInteractive ? " cursor-pointer" : ""}`}
                    onClick={() => {
                      if (survey.selectionMode === "paint" && activeResponseLabel) {
                        const current = responses[cell.exportKey];
                        applyResponse(
                          cell.exportKey,
                          current === activeResponseLabel ? null : activeResponseLabel,
                        );
                      }
                    }}
                    onDragOver={(e) => {
                      if (survey.selectionMode !== "dragdrop") return;
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
                      if (survey.selectionMode !== "dragdrop") return;
                      e.preventDefault();
                      const dropped =
                        draggedResponseLabel ?? e.dataTransfer.getData("text/plain");
                      if (!dropped) {
                        setDragOverCell(null);
                        return;
                      }
                      applyResponse(
                        cell.exportKey,
                        dropped === "__CLEAR_RESP__" ? null : dropped,
                      );
                      setDragOverCell(null);
                      setDraggedResponseLabel(null);
                    }}
                    style={
                      isRespDropTarget
                        ? {
                            backgroundColor: "#e2e8f0",
                            borderColor: "#0f172a",
                            color: "#0f172a",
                          }
                        : hasResponse && assignedCat
                        ? {
                            backgroundColor: hexToRgba(catColor, 0.2),
                            borderColor: respColor,
                            color: "#0f172a",
                          }
                        : hasResponse
                        ? {
                            backgroundColor: "#ffffff",
                            borderColor: respColor,
                            color: "#1e293b",
                          }
                        : assignedCat
                        ? {
                            backgroundColor: hexToRgba(catColor, 0.2),
                            borderColor: catColor,
                            color: "#0f172a",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: "#cbd5e1",
                            color: "#1e293b",
                          }
                    }
                  >
                    {/* Pre-filled content — top portion */}
                    <div
                      className="flex min-h-0 flex-1 flex-col overflow-hidden"
                      style={
                        assignedCat && (survey.selectionMode === "dropdown" || hasResponse)
                          ? { borderBottom: `1px solid ${hexToRgba(catColor, 0.4)}` }
                          : !assignedCat && survey.selectionMode === "dropdown"
                          ? { borderBottom: "1px solid #e2e8f0" }
                          : undefined
                      }
                    >
                      {assignedCat ? (
                        renderAssignedContent(assignedCat, catImage)
                      ) : (
                        <div className="flex flex-1 items-center justify-center text-[9px] text-slate-400">
                          —
                        </div>
                      )}
                    </div>
                    {/* Dropdown mode — response select */}
                    {survey.selectionMode === "dropdown" && responseLabels.length > 0 && (
                      <div className="flex-shrink-0 p-0.5">
                        <select
                          aria-label={`Response for row ${cell.row} column ${cell.col}`}
                          value={selectedResponse}
                          onChange={(e) =>
                            applyResponse(cell.exportKey, e.target.value || null)
                          }
                          className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[9px] text-slate-900 outline-none focus:border-sky-500"
                        >
                          <option value="">— react —</option>
                          {responseLabels.map((lbl) => (
                            <option key={lbl} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* Paint / drag-drop mode — response indicator when applied */}
                    {survey.selectionMode !== "dropdown" && hasResponse && (
                      <div
                        className="flex flex-shrink-0 flex-col items-center overflow-hidden px-0.5 pb-0.5"
                        style={{
                          backgroundColor: hexToRgba(respColor, 0.15),
                          borderTop: `1px solid ${hexToRgba(respColor, 0.4)}`,
                        }}
                      >
                        {respImage && (
                          <img
                            src={respImage}
                            alt={selectedResponse}
                            className="mt-0.5 max-h-4 max-w-full object-contain"
                          />
                        )}
                        <span
                          className="w-full truncate text-center text-[8px] font-semibold leading-tight"
                          style={{ color: respColor }}
                        >
                          {selectedResponse}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }

              // Standard cell rendering (also used for experimental setup tab)
              return (
                <div
                  key={cell.key}
                  onClick={() => handlePaintCellClick(cell)}
                  onDragOver={(e) => {
                    if (expEnabled || !survey.allowInteraction || survey.selectionMode !== "dragdrop") {
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
                      expEnabled ||
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
                      cell.exportKey,
                      cell.key,
                      droppedCategory === "__CLEAR__" ? null : droppedCategory,
                    );
                    setDragOverCell(null);
                    setDraggedCategory(null);
                  }}
                  className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border font-medium ${
                    ((!expEnabled && survey.allowInteraction && survey.selectionMode === "paint") ||
                      (expEnabled &&
                        experimentalTab === "setup" &&
                        experimental.prefillMode !== "weighted")) &&
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
                  ) : !expEnabled && survey.allowInteraction &&
                    survey.selectionMode === "dropdown" &&
                    !cell.isCenter ? (
                    <div className="flex h-full flex-col justify-center gap-1 p-1">
                      <select
                        aria-label={`Choose label for row ${cell.row} column ${cell.col}`}
                        value={assignments[cell.key] ?? ""}
                        onChange={(e) =>
                          applyAssignment(cell.exportKey, cell.key, e.target.value || null)
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
                {expEnabled ? (
                  <ol className="flex flex-col gap-2">
                    <li>
                      In Qualtrics, open <strong>Survey</strong>, then{" "}
                      <strong>Survey Flow</strong>.
                    </li>
                    <li>
                      Add an <strong>Embedded Data</strong> element before this question.
                    </li>
                    <li>
                      Create two fields:{" "}
                      <code className="rounded bg-amber-100 px-1 font-mono font-bold">
                        GridPrefills
                      </code>{" "}
                      (what was shown) and{" "}
                      <code className="rounded bg-amber-100 px-1 font-mono font-bold">
                        GridResponses
                      </code>{" "}
                      (what the respondent selected). Leave both blank.
                    </li>
                    <li>
                      Go back to the question, open <strong>JavaScript</strong> under
                      question behavior, and paste the code.
                    </li>
                    <li>
                      Export results from <strong>Data &amp; Analysis</strong>.
                      Pre-fills are saved as{" "}
                      <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Dwarves"}`}</code>{" "}
                      and responses as{" "}
                      <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Good"}`}</code>.
                    </li>
                  </ol>
                ) : (
                  <ol className="flex flex-col gap-2">
                    <li>
                      In Qualtrics, open <strong>Survey</strong>, then{" "}
                      <strong>Survey Flow</strong>.
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
                      Go back to the question, open <strong>JavaScript</strong> under
                      question behavior, and paste the code.
                    </li>
                    <li>
                      Export results from <strong>Data &amp; Analysis</strong>. Responses
                      are saved as JSON like{" "}
                      <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Dwarves"}`}</code>.
                    </li>
                  </ol>
                )}
                <p>
                  If you have multiple grid questions, rename the embedded field(s) to
                  something unique like{" "}
                  <code className="rounded bg-amber-100 px-1 font-mono">
                    {expEnabled ? "GridPrefills_Q2" : "GridAssignments_Q2"}
                  </code>
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
