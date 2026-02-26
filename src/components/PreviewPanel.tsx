import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "../EditorContext";

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

    const centerRow =
      layout.centerRow ?? Math.ceil(layout.rows / 2);
    const centerCol =
      layout.centerCol ?? Math.ceil(layout.cols / 2);

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
    const exportConfig = {
      layout,
      tuning,
      survey,
    };

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

\t\tvar label = document.createElement("span");
\t\tlabel.textContent = "Placing:";
\t\tlabel.style.fontSize = "11px";
\t\tlabel.style.fontWeight = "600";
\t\tlabel.style.color = "#475569";
\t\ttoolbar.appendChild(label);

\t\tcategories.forEach(function (cat) {
\t\t\tvar btn = document.createElement("button");
\t\t\tbtn.type = "button";
\t\t\tbtn.textContent = cat;
\t\t\tbtn.style.borderRadius = "9999px";
\t\t\tbtn.style.border = "1px solid #e2e8f0";
\t\t\tbtn.style.padding = "2px 8px";
\t\t\tbtn.style.fontSize = "11px";
\t\t\tbtn.style.backgroundColor =
\t\t\t\tcat === activeCategory ? "#eff6ff" : "#ffffff";
\t\t\tbtn.style.color =
\t\t\t\tcat === activeCategory ? "#0369a1" : "#334155";
\t\t\tbtn.style.cursor = "pointer";
\t\t\tbtn.onclick = function () {
\t\t\t\tactiveCategory = cat;
\t\t\t\tArray.prototype.forEach.call(
\t\t\t\t\ttoolbar.querySelectorAll("button"),
\t\t\t\t\tfunction (other) {
\t\t\t\t\t\tother.style.backgroundColor =
\t\t\t\t\t\t\tother.textContent === cat ? "#eff6ff" : "#ffffff";
\t\t\t\t\t\tother.style.color =
\t\t\t\t\t\t\tother.textContent === cat ? "#0369a1" : "#334155";
\t\t\t\t\t},
\t\t\t\t);
\t\t\t};
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
\t\tcell.style.fontSize = "12px";
\t\tcell.style.fontWeight = "500";
\t\tcell.style.color = "#0f172a";

\t\tif (isCenter) {
\t\t\tcell.textContent = cfg.layout.centerCellLabel || "Your House";
\t\t\tcell.style.borderColor = "#38bdf8";
\t\t}

\t\tif (allowInteraction && categories.length > 0) {
\t\t\tcell.style.cursor = "pointer";
\t\t\t(function (cellRef, key, isCenterCell) {
\t\t\t\tcellRef.onclick = function () {
\t\t\t\t\tif (!activeCategory) return;
\t\t\t\t\tvar current = assignments[key];
\t\t\t\t\tif (current === activeCategory) {
\t\t\t\t\t\tdelete assignments[key];
\t\t\t\t\t\tcellRef.textContent = isCenterCell
\t\t\t\t\t\t\t? (cfg.layout.centerCellLabel || "Your House")
\t\t\t\t\t\t\t: "";
\t\t\t\t\t\tcellRef.style.backgroundColor = isCenterCell ? "#e0f2fe" : "#ffffff";
\t\t\t\t\t\tcellRef.style.borderColor = isCenterCell ? "#38bdf8" : "#cbd5e1";
\t\t\t\t\t} else {
\t\t\t\t\t\tassignments[key] = activeCategory;
\t\t\t\t\t\tcellRef.textContent = activeCategory;
\t\t\t\t\t\tcellRef.style.backgroundColor = "#e0f2fe";
\t\t\t\t\t\tcellRef.style.borderColor = "#38bdf8";
\t\t\t\t\t}
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
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  activeCategory === cat
                    ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
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
            gap: tuning.gridGap,
            padding: tuning.gridPadding,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              onClick={() => handleCellClick(cell.key)}
              className={`flex items-center justify-center rounded-md border text-xs font-medium ${
                survey.allowInteraction ? "cursor-pointer transition-colors" : ""
              } ${
                assignments[cell.key]
                  ? "bg-sky-100 border-sky-500 text-slate-900"
                  : cell.isCenter
                  ? "bg-sky-50 border-sky-400 text-slate-800"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              {assignments[cell.key]
                ? assignments[cell.key]
                : cell.isCenter
                ? layout.centerCellLabel || "Your House"
                : ""}
            </div>
          ))}
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
    </section>
  );
};

export default PreviewPanel;

