import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";
import { SelectionMode } from "../grid-types";

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

function renderAssignedContent(
  category: string,
  imageUrl: string,
) {
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

  const qualtricsSnippet = useMemo(() => {
    const exportConfig = { layout, tuning, survey };
    const cfgJson = JSON.stringify(exportConfig, null, 2);

    return `Qualtrics.SurveyEngine.addOnload(function()
{
\t/* Optional: code to run when the page loads */

});

Qualtrics.SurveyEngine.addOnReady(function()
{
\tvar container = this.getQuestionTextContainer();
\tif (!container) return;

\tcontainer.innerHTML = "";

\tvar cfg = ${cfgJson};
\tvar surveyCfg = cfg.survey || {};
\tvar categories = [];
\tvar allowInteraction = !!surveyCfg.allowInteraction;
\tvar selectionMode = surveyCfg.selectionMode || "paint";
\tvar assignments = {};
\tvar activeCategory = null;
\tvar draggedCategory = null;

\tif (surveyCfg.categoriesCsv) {
\t\tcategories = surveyCfg.categoriesCsv
\t\t\t.split(",")
\t\t\t.map(function (c) { return c.trim(); })
\t\t\t.filter(function (c) { return c.length > 0; });
\t}

\tif (categories.length > 0) {
\t\tactiveCategory = categories[0];
\t}

\tfunction hexToRgba(hex, alpha) {
\t\tvar r = parseInt(hex.slice(1, 3), 16);
\t\tvar g = parseInt(hex.slice(3, 5), 16);
\t\tvar b = parseInt(hex.slice(5, 7), 16);
\t\treturn "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
\t}

\tfunction getCategoryMeta(catName) {
\t\tif (!surveyCfg.categoryMeta) return {};
\t\treturn surveyCfg.categoryMeta[catName] || {};
\t}

\tfunction persistAssignments() {
\t\tQualtrics.SurveyEngine.setEmbeddedData("GridAssignments", JSON.stringify(assignments));
\t}

\tfunction resetCellBaseStyles(cellRef, isCenterCell) {
\t\tcellRef.style.display = "flex";
\t\tcellRef.style.flexDirection = "column";
\t\tcellRef.style.alignItems = "stretch";
\t\tcellRef.style.justifyContent = "center";
\t\tcellRef.style.overflow = "hidden";
\t\tcellRef.style.backgroundColor = isCenterCell ? "#e0f2fe" : "#ffffff";
\t\tcellRef.style.borderColor = isCenterCell ? "#38bdf8" : "#cbd5e1";
\t\tcellRef.style.color = "#0f172a";
\t}

\tfunction renderCellContent(cellRef, catName, catColor, catImage) {
\t\tcellRef.innerHTML = "";
\t\tresetCellBaseStyles(cellRef, false);
\t\tcellRef.style.backgroundColor = hexToRgba(catColor, 0.2);
\t\tcellRef.style.borderColor = catColor;

\t\tif (catImage) {
\t\t\tvar imgWrap = document.createElement("div");
\t\t\timgWrap.style.flex = "1";
\t\t\timgWrap.style.minHeight = "0";
\t\t\timgWrap.style.display = "flex";
\t\t\timgWrap.style.alignItems = "center";
\t\t\timgWrap.style.justifyContent = "center";
\t\t\timgWrap.style.overflow = "hidden";
\t\t\timgWrap.style.padding = "2px";

\t\t\tvar img = document.createElement("img");
\t\t\timg.src = catImage;
\t\t\timg.alt = catName;
\t\t\timg.style.maxWidth = "100%";
\t\t\timg.style.maxHeight = "100%";
\t\t\timg.style.objectFit = "contain";
\t\t\timgWrap.appendChild(img);
\t\t\tcellRef.appendChild(imgWrap);
\t\t}

\t\tvar textWrap = document.createElement("div");
\t\ttextWrap.style.textAlign = "center";
\t\ttextWrap.style.lineHeight = "1.2";
\t\ttextWrap.style.fontWeight = "500";

\t\tif (catImage) {
\t\t\ttextWrap.style.flexShrink = "0";
\t\t\ttextWrap.style.padding = "0 2px 2px";
\t\t\ttextWrap.style.fontSize = "9px";
\t\t\ttextWrap.style.whiteSpace = "nowrap";
\t\t\ttextWrap.style.overflow = "hidden";
\t\t\ttextWrap.style.textOverflow = "ellipsis";
\t\t} else {
\t\t\ttextWrap.style.flex = "1";
\t\t\ttextWrap.style.display = "flex";
\t\t\ttextWrap.style.alignItems = "center";
\t\t\ttextWrap.style.justifyContent = "center";
\t\t\ttextWrap.style.padding = "4px";
\t\t\ttextWrap.style.fontSize = "10px";
\t\t}

\t\ttextWrap.textContent = catName;
\t\tcellRef.appendChild(textWrap);
\t}

\tfunction renderDropdownCell(cellRef, key, isCenterCell) {
\t\tcellRef.innerHTML = "";
\t\tresetCellBaseStyles(cellRef, isCenterCell);
\t\tcellRef.style.padding = "4px";
\t\tcellRef.style.gap = "4px";

\t\tif (isCenterCell) {
\t\t\tvar centerLabel = document.createElement("div");
\t\t\tcenterLabel.textContent = cfg.layout.centerCellLabel || "Your House";
\t\t\tcenterLabel.style.fontSize = "10px";
\t\t\tcenterLabel.style.fontWeight = "600";
\t\t\tcenterLabel.style.textAlign = "center";
\t\t\tcenterLabel.style.lineHeight = "1.2";
\t\t\tcellRef.appendChild(centerLabel);
\t\t}

\t\tvar select = document.createElement("select");
\t\tselect.style.width = "100%";
\t\tselect.style.minWidth = "0";
\t\tselect.style.border = "1px solid #cbd5e1";
\t\tselect.style.borderRadius = "6px";
\t\tselect.style.backgroundColor = "#ffffff";
\t\tselect.style.padding = "4px 6px";
\t\tselect.style.fontSize = "10px";
\t\tselect.style.color = "#0f172a";

\t\tvar emptyOption = document.createElement("option");
\t\temptyOption.value = "";
\t\temptyOption.textContent = "Choose label";
\t\tselect.appendChild(emptyOption);

\t\tcategories.forEach(function (cat) {
\t\t\tvar option = document.createElement("option");
\t\t\toption.value = cat;
\t\t\toption.textContent = cat;
\t\t\tselect.appendChild(option);
\t\t});

\t\tselect.value = assignments[key] || "";
\t\tselect.onchange = function () {
\t\t\tif (!select.value) {
\t\t\t\tdelete assignments[key];
\t\t\t} else {
\t\t\t\tassignments[key] = select.value;
\t\t\t}
\t\t\tpersistAssignments();
\t\t\trenderCell(cellRef, key, isCenterCell);
\t\t};

\t\tcellRef.appendChild(select);
\t}

\tfunction renderCell(cellRef, key, isCenterCell) {
\t\tvar assigned = assignments[key];
\t\tif (assigned) {
\t\t\tvar meta = getCategoryMeta(assigned);
\t\t\trenderCellContent(cellRef, assigned, meta.color || "#60a5fa", meta.imageUrl || "");
\t\t\treturn;
\t\t}

\t\tif (allowInteraction && selectionMode === "dropdown" && !isCenterCell) {
\t\t\trenderDropdownCell(cellRef, key, isCenterCell);
\t\t\treturn;
\t\t}

\t\tcellRef.innerHTML = "";
\t\tresetCellBaseStyles(cellRef, isCenterCell);

\t\tif (isCenterCell) {
\t\t\tvar label = document.createElement("div");
\t\t\tlabel.textContent = cfg.layout.centerCellLabel || "Your House";
\t\t\tlabel.style.width = "100%";
\t\t\tlabel.style.padding = "4px";
\t\t\tlabel.style.fontSize = "10px";
\t\t\tlabel.style.fontWeight = "500";
\t\t\tlabel.style.textAlign = "center";
\t\t\tlabel.style.lineHeight = "1.2";
\t\t\tcellRef.appendChild(label);
\t\t}
\t}

\tfunction createCategoryChip(catName, isClear) {
\t\tvar meta = getCategoryMeta(catName);
\t\tvar color = isClear ? "#94a3b8" : (meta.color || "#60a5fa");
\t\tvar chip = document.createElement("button");
\t\tchip.type = "button";
\t\tchip.textContent = catName;
\t\tchip.style.display = "inline-flex";
\t\tchip.style.alignItems = "center";
\t\tchip.style.justifyContent = "center";
\t\tchip.style.borderRadius = "9999px";
\t\tchip.style.border = "1px solid #e2e8f0";
\t\tchip.style.padding = "4px 10px";
\t\tchip.style.fontSize = "11px";
\t\tchip.style.fontWeight = "500";
\t\tchip.style.backgroundColor = isClear ? "#ffffff" : hexToRgba(color, 0.12);
\t\tchip.style.color = "#334155";
\t\tchip.style.cursor = "grab";
\t\tchip.draggable = true;

\t\tchip.ondragstart = function (event) {
\t\t\tdraggedCategory = isClear ? "__CLEAR__" : catName;
\t\t\tif (event.dataTransfer) {
\t\t\t\tevent.dataTransfer.setData("text/plain", draggedCategory);
\t\t\t\tevent.dataTransfer.effectAllowed = "move";
\t\t\t}
\t\t};

\t\tchip.ondragend = function () {
\t\t\tdraggedCategory = null;
\t\t};

\t\treturn chip;
\t}

\tvar questionText = document.createElement("p");
\tquestionText.textContent = cfg.layout.questionText;
\tquestionText.style.marginBottom = "8px";
\tcontainer.appendChild(questionText);

\tif (allowInteraction && categories.length > 0 && selectionMode === "paint") {
\t\tvar toolbar = document.createElement("div");
\t\ttoolbar.style.display = "flex";
\t\ttoolbar.style.flexWrap = "wrap";
\t\ttoolbar.style.alignItems = "center";
\t\ttoolbar.style.gap = "4px";
\t\ttoolbar.style.marginBottom = "6px";

\t\tvar toolbarLabel = document.createElement("span");
\t\ttoolbarLabel.textContent = "Placing:";
\t\ttoolbarLabel.style.fontSize = "11px";
\t\ttoolbarLabel.style.fontWeight = "600";
\t\ttoolbarLabel.style.color = "#475569";
\t\ttoolbar.appendChild(toolbarLabel);

\t\tcategories.forEach(function (cat) {
\t\t\tvar meta = getCategoryMeta(cat);
\t\t\tvar color = meta.color || "#60a5fa";
\t\t\tvar btn = document.createElement("button");
\t\t\tbtn.type = "button";
\t\t\tbtn.dataset.cat = cat;
\t\t\tbtn.style.display = "inline-flex";
\t\t\tbtn.style.alignItems = "center";
\t\t\tbtn.style.gap = "4px";
\t\t\tbtn.style.borderRadius = "9999px";
\t\t\tbtn.style.border = cat === activeCategory ? "1px solid " + color : "1px solid #e2e8f0";
\t\t\tbtn.style.padding = "2px 8px";
\t\t\tbtn.style.fontSize = "11px";
\t\t\tbtn.style.backgroundColor = cat === activeCategory ? hexToRgba(color, 0.15) : "#ffffff";
\t\t\tbtn.style.color = "#334155";
\t\t\tbtn.style.cursor = "pointer";

\t\t\tvar dot = document.createElement("span");
\t\t\tdot.style.display = "inline-block";
\t\t\tdot.style.width = "8px";
\t\t\tdot.style.height = "8px";
\t\t\tdot.style.borderRadius = "9999px";
\t\t\tdot.style.backgroundColor = color;
\t\t\tdot.style.flexShrink = "0";
\t\t\tbtn.appendChild(dot);
\t\t\tbtn.appendChild(document.createTextNode(cat));

\t\t\tbtn.onclick = function () {
\t\t\t\tactiveCategory = cat;
\t\t\t\tArray.prototype.forEach.call(toolbar.querySelectorAll("button"), function (other) {
\t\t\t\t\tvar otherMeta = getCategoryMeta(other.dataset.cat);
\t\t\t\t\tvar otherColor = otherMeta.color || "#60a5fa";
\t\t\t\t\tvar isActive = other.dataset.cat === cat;
\t\t\t\t\tother.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#ffffff";
\t\t\t\t\tother.style.borderColor = isActive ? otherColor : "#e2e8f0";
\t\t\t\t});
\t\t\t};

\t\t\ttoolbar.appendChild(btn);
\t\t});

\t\tcontainer.appendChild(toolbar);
\t}

\tif (allowInteraction && categories.length > 0 && selectionMode === "dragdrop") {
\t\tvar dragHelp = document.createElement("div");
\t\tdragHelp.style.display = "flex";
\t\tdragHelp.style.flexDirection = "column";
\t\tdragHelp.style.gap = "6px";
\t\tdragHelp.style.marginBottom = "8px";

\t\tvar dragLabel = document.createElement("span");
\t\tdragLabel.textContent = "Drag a label onto a cell:";
\t\tdragLabel.style.fontSize = "11px";
\t\tdragLabel.style.fontWeight = "600";
\t\tdragLabel.style.color = "#475569";
\t\tdragHelp.appendChild(dragLabel);

\t\tvar dragTray = document.createElement("div");
\t\tdragTray.style.display = "flex";
\t\tdragTray.style.flexWrap = "wrap";
\t\tdragTray.style.gap = "6px";

\t\tcategories.forEach(function (cat) {
\t\t\tdragTray.appendChild(createCategoryChip(cat, false));
\t\t});
\t\tdragTray.appendChild(createCategoryChip("Clear cell", true));

\t\tdragHelp.appendChild(dragTray);
\t\tcontainer.appendChild(dragHelp);
\t}

\tvar wrapper = document.createElement("div");
\twrapper.style.width = cfg.tuning.previewWidth + "px";
\twrapper.style.height = cfg.tuning.previewHeight + "px";
\twrapper.style.border = "1px solid #cbd5e1";
\twrapper.style.backgroundColor = "#f8fafc";
\twrapper.style.overflow = "auto";
\twrapper.style.borderRadius = "0.75rem";
\twrapper.style.position = "relative";

\tif (cfg.layout.backgroundImageUrl) {
\t\twrapper.style.backgroundImage = "url(" + cfg.layout.backgroundImageUrl + ")";
\t\twrapper.style.backgroundRepeat = "no-repeat";
\t\twrapper.style.backgroundPosition = "center";
\t\twrapper.style.backgroundSize = "contain";
\t}

\tvar grid = document.createElement("div");
\tgrid.style.display = "grid";
\tgrid.style.width = "100%";
\tgrid.style.height = "100%";
\tgrid.style.boxSizing = "border-box";
\tgrid.style.gridTemplateColumns = "repeat(" + cfg.layout.cols + ", minmax(0, 1fr))";
\tgrid.style.gridTemplateRows = "repeat(" + cfg.layout.rows + ", minmax(0, 1fr))";
\tgrid.style.gap = cfg.tuning.gridGap + "px";
\tgrid.style.padding = cfg.tuning.gridPadding + "px";

\tvar totalCells = cfg.layout.rows * cfg.layout.cols;
\tvar centerRow = cfg.layout.centerRow || Math.ceil(cfg.layout.rows / 2);
\tvar centerCol = cfg.layout.centerCol || Math.ceil(cfg.layout.cols / 2);

\tfor (var i = 0; i < totalCells; i++) {
\t\tvar row = Math.floor(i / cfg.layout.cols) + 1;
\t\tvar col = (i % cfg.layout.cols) + 1;
\t\tvar isCenter = cfg.layout.includeCenterCell && row === centerRow && col === centerCol;
\t\tvar key = "r" + row + "-c" + col;
\t\tvar cell = document.createElement("div");
\t\tcell.style.borderRadius = "0.375rem";
\t\tcell.style.border = "1px solid #cbd5e1";
\t\tcell.style.minWidth = "0";
\t\tcell.style.minHeight = "0";
\t\tcell.style.fontSize = "10px";
\t\tcell.style.fontWeight = "500";
\t\tcell.style.transition = "border-color 120ms ease, background-color 120ms ease";

\t\trenderCell(cell, key, isCenter);

\t\tif (allowInteraction && selectionMode === "paint") {
\t\t\tcell.style.cursor = isCenter ? "default" : "pointer";
\t\t\t(function (cellRef, cellKey, isCenterCell) {
\t\t\t\tcellRef.onclick = function () {
\t\t\t\t\tif (isCenterCell) return;
\t\t\t\t\tif (!activeCategory) return;
\t\t\t\t\tif (assignments[cellKey] === activeCategory) {
\t\t\t\t\t\tdelete assignments[cellKey];
\t\t\t\t\t} else {
\t\t\t\t\t\tassignments[cellKey] = activeCategory;
\t\t\t\t\t}
\t\t\t\t\tpersistAssignments();
\t\t\t\t\trenderCell(cellRef, cellKey, isCenterCell);
\t\t\t\t};
\t\t\t})(cell, key, isCenter);
\t\t}

\t\tif (allowInteraction && selectionMode === "dragdrop") {
\t\t\t(function (cellRef, cellKey, isCenterCell) {
\t\t\t\tcellRef.style.cursor = isCenterCell ? "default" : "copy";
\t\t\t\tcellRef.ondragover = function (event) {
\t\t\t\t\tif (isCenterCell) return;
\t\t\t\t\tevent.preventDefault();
\t\t\t\t\tif (event.dataTransfer) {
\t\t\t\t\t\tevent.dataTransfer.dropEffect = "move";
\t\t\t\t\t}
\t\t\t\t\tcellRef.style.borderColor = "#0f172a";
\t\t\t\t\tcellRef.style.backgroundColor = "#e2e8f0";
\t\t\t\t};
\t\t\t\tcellRef.ondragleave = function () {
\t\t\t\t\trenderCell(cellRef, cellKey, isCenterCell);
\t\t\t\t};
\t\t\t\tcellRef.ondrop = function (event) {
\t\t\t\t\tif (isCenterCell) return;
\t\t\t\t\tevent.preventDefault();
\t\t\t\t\tvar dropped = draggedCategory;
\t\t\t\t\tif (!dropped && event.dataTransfer) {
\t\t\t\t\t\tdropped = event.dataTransfer.getData("text/plain");
\t\t\t\t\t}
\t\t\t\t\tif (!dropped) {
\t\t\t\t\t\trenderCell(cellRef, cellKey, isCenterCell);
\t\t\t\t\t\treturn;
\t\t\t\t\t}
\t\t\t\t\tif (dropped === "__CLEAR__") {
\t\t\t\t\t\tdelete assignments[cellKey];
\t\t\t\t\t} else {
\t\t\t\t\t\tassignments[cellKey] = dropped;
\t\t\t\t\t}
\t\t\t\t\tpersistAssignments();
\t\t\t\t\trenderCell(cellRef, cellKey, isCenterCell);
\t\t\t\t};
\t\t\t})(cell, key, isCenter);
\t\t}

\t\tgrid.appendChild(cell);
\t}

\twrapper.appendChild(grid);
\tcontainer.appendChild(wrapper);
});

Qualtrics.SurveyEngine.addOnUnload(function()
{
\t/* Optional: code to run when the page is unloaded */

});`;
  }, [layout, tuning, survey]);

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
    <section
      aria-label="Grid preview"
      className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Live preview</h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{layout.rows} × {layout.cols}</span>
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
        className="relative w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50"
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
                  if (survey.selectionMode === "dragdrop" && dragOverCell === cell.key) {
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

      <section className="mt-4 flex flex-col gap-2">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-700">
            Qualtrics JavaScript (copy into Question JS)
          </h3>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </header>
        <textarea
          className="h-64 w-full resize-none rounded-md border border-slate-200 bg-slate-950/90 p-2 font-mono text-[11px] text-slate-50 shadow-inner"
          readOnly
          value={qualtricsSnippet}
          onFocus={(e) => e.currentTarget.select()}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-xs font-semibold text-amber-900">
          How to connect this to Qualtrics data
        </h3>
        <ol className="flex flex-col gap-2 text-xs text-amber-800">
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">1.</span>
            <span>
              In your Qualtrics survey, click <strong>Survey</strong> in the top navigation bar and then <strong>Survey Flow</strong> in the left sidebar.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">2.</span>
            <span>
              Click <strong>Add a New Element Here</strong> and choose <strong>Embedded Data</strong>.
              Drag it so it appears <em>before</em> the question block that has this grid.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">3.</span>
            <span>
              Click <strong>Add a New Field</strong> and type exactly:{" "}
              <code className="rounded bg-amber-100 px-1 font-mono font-bold">GridAssignments</code>.
              Leave the value blank. Click <strong>Apply</strong> and save.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">4.</span>
            <span>
              Make sure you're in <strong>Survey</strong> in the top nav bar, then click <strong>Builder</strong> on the
              left sidebar. Under <strong>Question behavior</strong>, click <strong>JavaScript</strong>, then paste in
              the code above.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">5.</span>
            <span>
              That's it! No matter which interaction mode you choose, placements are saved automatically.
              To see the results, go to <strong>Data &amp; Analysis → Export Data</strong>. The{" "}
              <code className="rounded bg-amber-100 px-1 font-mono font-bold">GridAssignments</code> column
              will contain each person's placements as JSON, for example{" "}
              <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Dwarves","r2-c3":"Elves"}`}</code>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold">Tip:</span>
            <span>
              If you have multiple grid questions in the same survey, rename the field in step 3 (and in the code) to something unique per question, like{" "}
              <code className="rounded bg-amber-100 px-1 font-mono">GridAssignments_Q2</code>.
            </span>
          </li>
        </ol>
      </section>
    </section>
  );
};

export default PreviewPanel;
