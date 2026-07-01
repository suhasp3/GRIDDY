import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";
import { LayerMode, WeightEntry } from "../grid-types";
import {
  buildQualtricsSnippet,
  buildQualtricsQsfForConfig,
} from "../lib/qualtricsExport";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function renderAssignedContent(
  category: string,
  imageUrl: string,
  color: string,
  layerMode: LayerMode = "replace",
) {
  if (imageUrl && layerMode === "front") {
    return (
      <>
        <img
          src={imageUrl}
          alt={category}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <span
          className="absolute bottom-0 left-0 right-0 truncate px-0.5 pb-0.5 text-center text-[8px] font-medium leading-tight"
          style={{ backgroundColor: hexToRgba(color, 0.75), color: "#0f172a" }}
        >
          {category}
        </span>
      </>
    );
  }

  if (imageUrl && layerMode === "behind") {
    return (
      <>
        <img
          src={imageUrl}
          alt={category}
          className="absolute inset-0 h-full w-full object-contain opacity-20"
        />
        <div className="relative z-10 flex flex-1 items-center justify-center p-1 text-center text-[10px] leading-tight">
          {category}
        </div>
      </>
    );
  }

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
  const qualtricsQsf = useMemo(
    () => buildQualtricsQsfForConfig(config),
    [config],
  );
  const exportFields = useMemo(
    () =>
      expEnabled
        ? ["GridPrefills", "GridResponses"]
        : ["GridAssignments"],
    [expEnabled],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qualtricsSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadQsf = () => {
    const safeName =
      (config.name || "griddy-survey")
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") || "griddy-survey";
    const blob = new Blob([qualtricsQsf], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.qsf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
        className="flex flex-col gap-3 rounded-xl border border-hairline-warm bg-paper-card p-5 md:sticky md:top-6"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold text-ink">Live preview</h2>
          <span className="font-serif text-[12.5px] italic text-ink-muted">
            {expEnabled
              ? experimentalTab === "setup"
                ? `Setup · ${experimental.prefillMode.charAt(0).toUpperCase() + experimental.prefillMode.slice(1)}`
                : "Respondent view"
              : `${layout.rows} × ${layout.cols}`}
          </span>
        </header>

        {/* Setup / Respondent toggle — only when experiment is on */}
        {expEnabled && (
          <div className="inline-flex items-center gap-1 self-start rounded-lg border border-hairline-warm bg-paper-window p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setExperimentalTab("setup")}
              className={`rounded-[7px] px-3.5 py-1.5 font-bold transition-colors ${
                experimentalTab === "setup"
                  ? "bg-paper-card text-ink shadow-sm"
                  : "text-ink-muted hover:bg-paper-card/60"
              }`}
            >
              Setup
            </button>
            <button
              type="button"
              onClick={switchToRespondent}
              className={`rounded-[7px] px-3.5 py-1.5 font-bold transition-colors ${
                experimentalTab === "respondent"
                  ? "bg-paper-card text-ink shadow-sm"
                  : "text-ink-muted hover:bg-paper-card/60"
              }`}
            >
              Respondent preview
            </button>
          </div>
        )}

        {/* Weighted-mode hint (no button here — Regenerate lives in the bottom bar) */}
        {expEnabled &&
          experimentalTab === "setup" &&
          experimental.prefillMode === "weighted" && (
            <p className="text-xs text-ink-muted">
              Sample preview — each respondent gets an independent draw.
            </p>
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No response labels defined — add them in the experiment section.
          </p>
        )}

        <p className="font-serif text-[17px] text-ink">{layout.questionText}</p>

        <div
          className="relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-hairline-warm bg-paper-window"
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
              const catLayerMode: LayerMode = catMeta?.layerMode ?? "replace";
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
                const respLayerMode: LayerMode = respMeta?.layerMode ?? "replace";
                const hasResponse = Boolean(selectedResponse);
                const isRespDropTarget =
                  survey.selectionMode === "dragdrop" && dragOverCell === cell.key;
                const isInteractive = survey.selectionMode !== "dropdown";

                return (
                  <div
                    key={cell.key}
                    className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg font-medium transition-colors${
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
                            backgroundColor: catLayerMode === "front" ? "transparent" : hexToRgba(catColor, 0.2),
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
                            backgroundColor: catLayerMode === "front" ? "transparent" : hexToRgba(catColor, 0.2),
                            borderColor: catLayerMode === "front" ? hexToRgba(catColor, 0.5) : catColor,
                            color: "#0f172a",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: "#cbd5e1",
                            color: "#1e293b",
                          }
                    }
                  >
                    {/* r·c coordinate tag */}
                    <span
                      className="absolute left-1.5 top-1 font-mono text-[8.5px] leading-none"
                      style={{ color: "#9a8f78" }}
                    >
                      {`r${cell.row}·c${cell.col}`}
                    </span>

                    {/* Pre-filled content — top portion */}
                    <div
                      className={`flex min-h-0 flex-1 flex-col overflow-hidden pt-3${assignedCat && catLayerMode !== "replace" ? " relative" : ""}`}
                      style={
                        assignedCat && (survey.selectionMode === "dropdown" || hasResponse)
                          ? { borderBottom: `1px solid ${hexToRgba(catColor, 0.4)}` }
                          : !assignedCat && survey.selectionMode === "dropdown"
                          ? { borderBottom: "1px solid #e2e8f0" }
                          : undefined
                      }
                    >
                      {assignedCat ? (
                        renderAssignedContent(assignedCat, catImage, catColor, catLayerMode)
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
                    {/* Paint / drag-drop mode — response overlay (front mode) */}
                    {survey.selectionMode !== "dropdown" && hasResponse && respImage && respLayerMode === "front" && (
                      <>
                        <img
                          src={respImage}
                          alt={selectedResponse}
                          className="absolute inset-0 h-full w-full object-contain"
                          style={{ zIndex: 10 }}
                        />
                        <span
                          className="absolute bottom-0 left-0 right-0 truncate px-0.5 pb-0.5 text-center text-[8px] font-semibold leading-tight"
                          style={{ backgroundColor: hexToRgba(respColor, 0.85), color: respColor, zIndex: 11 }}
                        >
                          {selectedResponse}
                        </span>
                      </>
                    )}
                    {/* Paint / drag-drop mode — response band (replace / behind) */}
                    {survey.selectionMode !== "dropdown" && hasResponse && !(respImage && respLayerMode === "front") && (
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
                  className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border font-medium ${
                    ((!expEnabled && survey.allowInteraction && survey.selectionMode === "paint") ||
                      (expEnabled &&
                        experimentalTab === "setup" &&
                        experimental.prefillMode !== "weighted")) &&
                    !cell.isCenter
                      ? "cursor-pointer transition-colors"
                      : ""
                  }${assignedCat && catLayerMode !== "replace" ? " relative" : ""}`}
                  style={
                    assignedCat
                      ? catLayerMode === "front"
                        ? {
                            backgroundColor: "transparent",
                            borderColor: hexToRgba(catColor, 0.5),
                            color: "#2a241c",
                          }
                        : {
                            backgroundColor: hexToRgba(catColor, 0.2),
                            borderColor: catColor,
                            color: "#2a241c",
                          }
                      : isDropTarget
                        ? {
                            backgroundColor: "#e2dccf",
                            borderColor: "#2a241c",
                            color: "#2a241c",
                          }
                        : cell.isCenter
                          ? {
                              backgroundColor: "#f7ece9",
                              borderStyle: "dashed",
                              borderColor: "#c08a92",
                              color: "#8a2e3b",
                            }
                          : {
                              backgroundColor: "#fbf8f1",
                              borderStyle: "dashed",
                              borderColor: "#d8cdb8",
                              color: "#2a241c",
                            }
                  }
                >
                  {/* r·c coordinate tag */}
                  <span
                    className="absolute left-1.5 top-1 font-mono text-[8.5px] leading-none"
                    style={{ color: cell.isCenter ? "#c79aa0" : "#9a8f78" }}
                  >
                    {`r${cell.row}·c${cell.col}`}
                  </span>

                  {assignedCat ? (
                    renderAssignedContent(assignedCat, catImage, catColor, catLayerMode)
                  ) : !expEnabled && survey.allowInteraction &&
                    survey.selectionMode === "dropdown" &&
                    !cell.isCenter ? (
                    <div className="flex h-full flex-col justify-center gap-1 p-1 pt-3">
                      <select
                        aria-label={`Choose label for row ${cell.row} column ${cell.col}`}
                        value={assignments[cell.key] ?? ""}
                        onChange={(e) =>
                          applyAssignment(cell.exportKey, cell.key, e.target.value || null)
                        }
                        className="w-full min-w-0 rounded border border-hairline bg-white px-1.5 py-1 text-[10px] text-ink outline-none"
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
                    <div className="flex flex-1 items-center justify-center p-1 pt-3">
                      <span className="w-full break-words text-center font-serif text-[10px] font-semibold leading-tight text-accent">
                        {layout.centerCellLabel || "Your House"}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend chips */}
        {(expEnabled
          ? experimentalTab === "respondent" ? responseLabels : categories
          : categories
        ).length > 0 && (
          <div className="flex flex-wrap gap-3">
            {(expEnabled
              ? experimentalTab === "respondent" ? responseLabels : categories
              : categories
            ).map((item) => {
              const color = expEnabled && experimentalTab === "respondent"
                ? (experimental.responseLabelMeta?.[item]?.color ?? "#8b5cf6")
                : (survey.categoryMeta[item]?.color ?? "#60a5fa");
              return (
                <span key={item} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {item}
                </span>
              );
            })}
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center gap-2.5 border-t border-hairline-warm pt-4">
          <button
            type="button"
            onClick={() => setIsCodeModalOpen(true)}
            className="flex-1 rounded-xl bg-accent py-3 text-center text-[14.5px] font-bold text-white hover:bg-accent/90"
          >
            Export to Qualtrics
          </button>
          {expEnabled && experimental.prefillMode === "weighted" && (
            <button
              type="button"
              onClick={regenerateWeighted}
              className="rounded-xl border border-hairline px-4 py-3 text-[13.5px] font-bold text-ink-muted hover:border-accent/40 hover:text-ink"
            >
              Regenerate
            </button>
          )}
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
                  onClick={handleDownloadQsf}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Download .qsf
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
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <section className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                  <div>
                    <h4 className="text-base font-semibold text-center">
                      Import the .qsf into Qualtrics
                    </h4>
                    <p className="mt-1 text-emerald-800">
                      The downloaded file builds the entire survey for you
                    </p>
                  </div>
                  <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold">
                    <li>
                      Click <strong>Download .qsf</strong> (top right of this
                      window).
                    </li>
                    <li>
                      In Qualtrics, go to <strong>Projects</strong> &rarr;{" "}
                      <strong>Create project</strong> &rarr;{" "}
                      <strong>Survey</strong>.
                    </li>
                    <li>
                      Choose <strong>“Import a QSF file”</strong>, select the
                      downloaded{" "}
                      <code className="rounded bg-emerald-100 px-1 font-mono">
                        .qsf
                      </code>
                      , and create the project.
                    </li>
                    <li>
                      <strong>Publish</strong>. Then the grid renders and
                      saves responses automatically.
                    </li>
                  </ol>
                  <div className="rounded-md border border-emerald-200 bg-white/60 p-3">
                    <p className="font-medium">Results land in these fields:</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {expEnabled ? (
                        <>
                          <li>
                            <code className="rounded bg-emerald-100 px-1 font-mono font-bold">
                              GridPrefills
                            </code>{" "}
                            — what was shown, e.g.{" "}
                            <code className="rounded bg-emerald-100 px-1 font-mono">{`{"r1-c1":"Dwarves"}`}</code>
                          </li>
                          <li>
                            <code className="rounded bg-emerald-100 px-1 font-mono font-bold">
                              GridResponses
                            </code>{" "}
                            — what the respondent selected, e.g.{" "}
                            <code className="rounded bg-emerald-100 px-1 font-mono">{`{"r1-c1":"Good"}`}</code>
                          </li>
                        </>
                      ) : (
                        <li>
                          <code className="rounded bg-emerald-100 px-1 font-mono font-bold">
                            GridAssignments
                          </code>{" "}
                          — e.g.{" "}
                          <code className="rounded bg-emerald-100 px-1 font-mono">{`{"r1-c1":"Dwarves"}`}</code>
                        </li>
                      )}
                    </ul>
                    <p className="mt-1.5 text-emerald-700">
                      Find them under <strong>Data &amp; Analysis</strong> after
                      collecting responses.
                    </p>
                  </div>
                </section>

                <details className="rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-800">
                    <span className="font-mono text-base">{`</>`}</span>
                    <span>Advanced: view raw JavaScript (manual paste)</span>
                  </summary>
                  <div className="border-t border-slate-200 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Only needed to paste into an existing survey. Add an
                        Embedded Data element to your Survey Flow with{" "}
                        {exportFields.map((f, i) => (
                          <span key={f}>
                            {i > 0 && " and "}
                            <code className="rounded bg-slate-100 px-1 font-mono">
                              {f}
                            </code>
                          </span>
                        ))}
                        , add a Text/Graphic question, and paste this into its{" "}
                        <strong>JavaScript</strong> editor.
                      </p>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex-shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        {copied ? "Copied!" : "Copy code"}
                      </button>
                    </div>
                    <textarea
                      className="h-[45vh] w-full resize-none rounded-xl border border-slate-200 bg-slate-950/90 p-3 font-mono text-[11px] text-slate-50 shadow-inner"
                      readOnly
                      value={qualtricsSnippet}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PreviewPanel;
