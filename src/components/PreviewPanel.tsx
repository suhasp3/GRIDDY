import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  useEffect(() => {
    if (!categories.length) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? null);
    }
  }, [categories, activeCategory]);

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

  const handleCellClick = (key: string) => {
    if (!survey.allowInteraction || !activeCategory) return;
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

\t// Clear any existing question HTML so we can inject the grid
\tcontainer.innerHTML = "";

\t// Configuration exported from NewGriddy
\tvar cfg = ${cfgJson};

\tvar categories = [];
\tvar allowInteraction = false;
\tif (cfg.survey) {
\t\tallowInteraction = !!cfg.survey.allowInteraction;
\t\tif (cfg.survey.categoriesCsv) {
\t\t\tcategories = cfg.survey.categoriesCsv
\t\t\t\t.split(",")
\t\t\t\t.map(function (c) { return c.trim(); })
\t\t\t\t.filter(function (c) { return c.length > 0; });
\t\t}
\t}

\tfunction hexToRgba(hex, alpha) {
\t\tvar r = parseInt(hex.slice(1, 3), 16);
\t\tvar g = parseInt(hex.slice(3, 5), 16);
\t\tvar b = parseInt(hex.slice(5, 7), 16);
\t\treturn "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
\t}

\tfunction renderCellContent(cellRef, catName, catColor, catImage) {
\t\tcellRef.innerHTML = "";
\t\tcellRef.style.display = "flex";
\t\tcellRef.style.flexDirection = "column";
\t\tcellRef.style.alignItems = "stretch";
\t\tcellRef.style.overflow = "hidden";
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
\t\tif (catImage) {
\t\t\ttextWrap.style.flexShrink = "0";
\t\t\ttextWrap.style.padding = "0 2px 2px";
\t\t\ttextWrap.style.fontSize = "9px";
\t\t} else {
\t\t\ttextWrap.style.flex = "1";
\t\t\ttextWrap.style.display = "flex";
\t\t\ttextWrap.style.alignItems = "center";
\t\t\ttextWrap.style.justifyContent = "center";
\t\t\ttextWrap.style.padding = "4px";
\t\t\ttextWrap.style.fontSize = "10px";
\t\t}
\t\ttextWrap.style.textAlign = "center";
\t\ttextWrap.style.lineHeight = "1.2";
\t\ttextWrap.style.overflow = "hidden";
\t\ttextWrap.style.textOverflow = "ellipsis";
\t\ttextWrap.style.whiteSpace = "nowrap";
\t\ttextWrap.style.fontWeight = "500";
\t\ttextWrap.textContent = catName;
\t\tcellRef.appendChild(textWrap);
\t\tcellRef.style.backgroundColor = hexToRgba(catColor, 0.2);
\t\tcellRef.style.borderColor = catColor;
\t}

\t// Question text
\tvar questionText = document.createElement("p");
\tquestionText.textContent = cfg.layout.questionText;
\tquestionText.style.marginBottom = "8px";
\tcontainer.appendChild(questionText);

\tvar activeCategory = categories.length ? categories[0] : null;
\tvar assignments = {};

\tif (allowInteraction && categories.length > 0) {
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
\t\t\tvar meta = (cfg.survey.categoryMeta && cfg.survey.categoryMeta[cat]) || {};
\t\t\tvar catColor = meta.color || "#60a5fa";

\t\t\tvar btn = document.createElement("button");
\t\t\tbtn.type = "button";
\t\t\tbtn.dataset.cat = cat;
\t\t\tbtn.style.display = "inline-flex";
\t\t\tbtn.style.alignItems = "center";
\t\t\tbtn.style.gap = "4px";
\t\t\tbtn.style.borderRadius = "9999px";
\t\t\tbtn.style.border = cat === activeCategory ? "1px solid " + catColor : "1px solid #e2e8f0";
\t\t\tbtn.style.padding = "2px 8px";
\t\t\tbtn.style.fontSize = "11px";
\t\t\tbtn.style.backgroundColor = cat === activeCategory ? hexToRgba(catColor, 0.15) : "#ffffff";
\t\t\tbtn.style.color = "#334155";
\t\t\tbtn.style.cursor = "pointer";

\t\t\tvar dot = document.createElement("span");
\t\t\tdot.style.display = "inline-block";
\t\t\tdot.style.width = "8px";
\t\t\tdot.style.height = "8px";
\t\t\tdot.style.borderRadius = "9999px";
\t\t\tdot.style.backgroundColor = catColor;
\t\t\tdot.style.flexShrink = "0";
\t\t\tbtn.appendChild(dot);
\t\t\tbtn.appendChild(document.createTextNode(cat));

\t\t\t(function (c, color) {
\t\t\t\tbtn.onclick = function () {
\t\t\t\t\tactiveCategory = c;
\t\t\t\t\tArray.prototype.forEach.call(
\t\t\t\t\t\ttoolbar.querySelectorAll("button"),
\t\t\t\t\t\tfunction (other) {
\t\t\t\t\t\t\tvar otherMeta = (cfg.survey.categoryMeta && cfg.survey.categoryMeta[other.dataset.cat]) || {};
\t\t\t\t\t\t\tvar otherColor = otherMeta.color || "#60a5fa";
\t\t\t\t\t\t\tvar isActive = other.dataset.cat === c;
\t\t\t\t\t\t\tother.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#ffffff";
\t\t\t\t\t\t\tother.style.borderColor = isActive ? otherColor : "#e2e8f0";
\t\t\t\t\t\t},
\t\t\t\t\t);
\t\t\t\t};
\t\t\t})(cat, catColor);

\t\t\ttoolbar.appendChild(btn);
\t\t});

\t\tcontainer.appendChild(toolbar);
\t}

\t// Outer wrapper for the grid
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

\t// Grid container
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

\t\tvar cell = document.createElement("div");
\t\tcell.style.display = "flex";
\t\tcell.style.alignItems = "center";
\t\tcell.style.justifyContent = "center";
\t\tcell.style.borderRadius = "0.375rem";
\t\tcell.style.border = "1px solid #cbd5e1";
\t\tcell.style.backgroundColor = isCenter ? "#e0f2fe" : "#ffffff";
\t\tcell.style.fontSize = "10px";
\t\tcell.style.fontWeight = "500";
\t\tcell.style.color = "#0f172a";
\t\tcell.style.overflow = "hidden";

\t\tif (isCenter) {
\t\t\tcell.textContent = cfg.layout.centerCellLabel || "Your House";
\t\t\tcell.style.borderColor = "#38bdf8";
\t\t}

\t\tif (allowInteraction && categories.length > 0) {
\t\t\tcell.style.cursor = "pointer";
\t\t\t(function (cellRef, key, isCenterCell) {
\t\t\t\tcellRef.onclick = function () {
\t\t\t\t\tif (!activeCategory) return;
\t\t\t\t\tvar meta = (cfg.survey.categoryMeta && cfg.survey.categoryMeta[activeCategory]) || {};
\t\t\t\t\tvar catColor = meta.color || "#60a5fa";
\t\t\t\t\tvar catImage = meta.imageUrl || "";
\t\t\t\t\tvar current = assignments[key];
\t\t\t\t\tif (current === activeCategory) {
\t\t\t\t\t\tdelete assignments[key];
\t\t\t\t\t\tcellRef.style.display = "flex";
\t\t\t\t\t\tcellRef.style.flexDirection = "row";
\t\t\t\t\t\tcellRef.style.alignItems = "center";
\t\t\t\t\t\tcellRef.style.justifyContent = "center";
\t\t\t\t\t\tcellRef.innerHTML = isCenterCell ? (cfg.layout.centerCellLabel || "Your House") : "";
\t\t\t\t\t\tcellRef.style.backgroundColor = isCenterCell ? "#e0f2fe" : "#ffffff";
\t\t\t\t\t\tcellRef.style.borderColor = isCenterCell ? "#38bdf8" : "#cbd5e1";
\t\t\t\t\t} else {
\t\t\t\t\t\tassignments[key] = activeCategory;
\t\t\t\t\t\trenderCellContent(cellRef, activeCategory, catColor, catImage);
\t\t\t\t\t}
\t\t\t\t	// Save current placements to Qualtrics after every change
\t\t\t\t	Qualtrics.SurveyEngine.setEmbeddedData("GridAssignments", JSON.stringify(assignments));
\t\t\t\t};
\t\t\t})(cell, "r" + row + "-c" + col, isCenter);
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
      // Swallow clipboard errors; user can still manually copy
      console.error(e);
    }
  };

  return (
    <section
      aria-label="Grid preview"
      className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Live preview
        </h2>
        <span className="text-xs text-slate-500">
          {layout.rows} × {layout.cols}
        </span>
      </header>

      {survey.allowInteraction && categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            Placing:
          </span>
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
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-sm text-slate-700">
        {layout.questionText}
      </p>

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
            const catMeta = assignedCat
              ? survey.categoryMeta[assignedCat]
              : null;
            const catColor = catMeta?.color ?? "#60a5fa";
            const catImage = catMeta?.imageUrl ?? "";

            return (
              <div
                key={cell.key}
                onClick={() => handleCellClick(cell.key)}
                className={`flex flex-col rounded-md border overflow-hidden font-medium ${
                  survey.allowInteraction ? "cursor-pointer transition-colors" : ""
                }`}
                style={
                  assignedCat
                    ? {
                        backgroundColor: hexToRgba(catColor, 0.2),
                        borderColor: catColor,
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
                  <>
                    {catImage && (
                      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-0.5">
                        <img
                          src={catImage}
                          alt={assignedCat}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div
                      className={`flex-shrink-0 w-full text-center leading-tight truncate px-0.5 ${
                        catImage
                          ? "text-[9px] pb-0.5"
                          : "flex-1 flex items-center justify-center text-[10px] p-1"
                      }`}
                    >
                      {assignedCat}
                    </div>
                  </>
                ) : cell.isCenter ? (
                  <div className="flex-1 flex items-center justify-center p-1">
                    <span className="w-full text-center text-[10px] leading-tight break-words">
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
            <span className="font-bold shrink-0">1.</span>
            <span>
              In your Qualtrics survey, click <strong>Survey Flow</strong> in the top navigation bar.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">2.</span>
            <span>
              Click <strong>Add a New Element Here</strong> and choose <strong>Embedded Data</strong>.
              Drag it so it appears <em>before</em> the question block that has this grid.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">3.</span>
            <span>
              Click <strong>Add a New Field</strong> and type exactly:{" "}
              <code className="rounded bg-amber-100 px-1 font-mono font-bold">GridAssignments</code>.
              Leave the value blank. Click <strong>Apply</strong> and save.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">4.</span>
            <span>
              Go back to your question. Click the <strong>gear icon</strong> on the question, then choose{" "}
              <strong>Add JavaScript</strong>. Paste the code above into the editor and click <strong>Save</strong>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">5.</span>
            <span>
              That's it! When a respondent places categories on the grid, their placements are saved automatically.
              To see the results, go to <strong>Data &amp; Analysis → Export Data</strong>. The{" "}
              <code className="rounded bg-amber-100 px-1 font-mono font-bold">GridAssignments</code> column
              will contain each person's placements as JSON — for example:{" "}
              <code className="rounded bg-amber-100 px-1 font-mono">{`{"r1-c1":"Dwarves","r2-c3":"Elves"}`}</code>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">Tip:</span>
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
