import { GridConfig } from "../grid-types";

export interface QualtricsExportOptions {
  embeddedDataField?: string;
}

export interface QualtricsMultiQuestionItem {
	title: string;
	embeddedDataField: string;
	config: GridConfig;
}

export function sanitizeEmbeddedDataField(name: string, fallback: string): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : `${fallback}_${cleaned}`;
  const normalized = prefixed || fallback;

  return normalized.length > 64 ? normalized.slice(0, 64) : normalized;
}

export function buildQualtricsSnippet(
  config: GridConfig,
  options: QualtricsExportOptions = {},
): string {
  const embeddedDataField = options.embeddedDataField ?? "GridAssignments";
  const exportConfig = {
    layout: config.layout,
    tuning: config.tuning,
    survey: config.survey,
    experimental: config.experimental ?? null,
  };
  const cfgJson = JSON.stringify(exportConfig, null, 2);

  return `Qualtrics.SurveyEngine.addOnload(function()
{
	/* Optional: code to run when the page loads */

});

Qualtrics.SurveyEngine.addOnReady(function()
{
	var question = this;
	var container = this.getQuestionTextContainer();
	if (!container) return;

	container.innerHTML = "";

	var cfg = ${cfgJson};
	var surveyCfg = cfg.survey || {};
	var categories = [];
	var allowInteraction = !!surveyCfg.allowInteraction;
	var selectionMode = surveyCfg.selectionMode || "paint";
	var assignments = {};
	var activeCategory = null;
	var draggedCategory = null;

	// Experimental mode
	var expCfg = cfg.experimental || {};
	var isExperimental = !!(expCfg && expCfg.enabled);
	var prefillMode = expCfg.prefillMode || "fixed";
	var fixedAssignments = expCfg.fixedAssignments || {};
	var weightedEntries = expCfg.weightedEntries || [];
	var responseLabels = [];
	if (expCfg.responseLabelsCsv) {
		responseLabels = expCfg.responseLabelsCsv
			.split(",")
			.map(function (l) { return l.trim(); })
			.filter(function (l) { return l.length > 0; });
	}
	var prefills = {};
	var experimentalResponses = {};

	if (surveyCfg.categoriesCsv) {
		categories = surveyCfg.categoriesCsv
			.split(",")
			.map(function (c) { return c.trim(); })
			.filter(function (c) { return c.length > 0; });
	}

	if (categories.length > 0) {
		activeCategory = categories[0];
	}

	function hexToRgba(hex, alpha) {
		var r = parseInt(hex.slice(1, 3), 16);
		var g = parseInt(hex.slice(3, 5), 16);
		var b = parseInt(hex.slice(5, 7), 16);
		return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
	}

	function getCategoryMeta(catName) {
		if (!surveyCfg.categoryMeta) return {};
		return surveyCfg.categoryMeta[catName] || {};
	}

	function persistAll() {
		if (isExperimental) {
			Qualtrics.SurveyEngine.setEmbeddedData("GridPrefills", JSON.stringify(prefills));
			Qualtrics.SurveyEngine.setEmbeddedData("GridResponses", JSON.stringify(experimentalResponses));
		} else {
			Qualtrics.SurveyEngine.setEmbeddedData(${JSON.stringify(embeddedDataField)}, JSON.stringify(assignments));
		}
	}

	function computePrefills(totalCells, centerRow, centerCol) {
		if (!isExperimental) return;
		if (prefillMode === "fixed") {
			Object.keys(fixedAssignments).forEach(function (k) {
				prefills[k] = fixedAssignments[k];
			});
		} else if (prefillMode === "shuffle") {
			var keys = Object.keys(fixedAssignments);
			var values = keys.map(function (k) { return fixedAssignments[k]; });
			for (var si = values.length - 1; si > 0; si--) {
				var sj = Math.floor(Math.random() * (si + 1));
				var tmp = values[si]; values[si] = values[sj]; values[sj] = tmp;
			}
			keys.forEach(function (k, idx) { prefills[k] = values[idx]; });
		} else if (prefillMode === "weighted") {
			var totalWeight = 0;
			weightedEntries.forEach(function (e) { totalWeight += e.weight; });
			if (totalWeight === 0) return;
			var cdf = [];
			var cum = 0;
			weightedEntries.forEach(function (e) {
				cum += e.weight / totalWeight;
				cdf.push({ category: e.category, cumulative: cum });
			});
			for (var ri = 1; ri <= cfg.layout.rows; ri++) {
				for (var ci = 1; ci <= cfg.layout.cols; ci++) {
					var isCenter = cfg.layout.includeCenterCell && ri === centerRow && ci === centerCol;
					if (isCenter) continue;
					var k = "r" + ri + "-c" + ci;
					var rand = Math.random();
					for (var ei = 0; ei < cdf.length; ei++) {
						if (rand <= cdf[ei].cumulative) {
							prefills[k] = cdf[ei].category;
							break;
						}
					}
				}
			}
		}
	}

	function renderExperimentalCell(cellRef, key, isCenterCell) {
		cellRef.innerHTML = "";
		cellRef.style.display = "flex";
		cellRef.style.flexDirection = "column";
		cellRef.style.overflow = "hidden";

		if (isCenterCell) {
			resetCellBaseStyles(cellRef, true);
			var centerLabel = document.createElement("div");
			centerLabel.textContent = cfg.layout.centerCellLabel || "Your House";
			centerLabel.style.fontSize = "10px";
			centerLabel.style.fontWeight = "500";
			centerLabel.style.textAlign = "center";
			centerLabel.style.lineHeight = "1.2";
			centerLabel.style.padding = "4px";
			cellRef.appendChild(centerLabel);
			return;
		}

		var catName = prefills[key];
		var meta = catName ? getCategoryMeta(catName) : {};
		var catColor = meta.color || null;
		var catImage = meta.imageUrl || "";

		// Top portion: pre-filled content
		var topDiv = document.createElement("div");
		topDiv.style.flex = "1";
		topDiv.style.minHeight = "0";
		topDiv.style.display = "flex";
		topDiv.style.flexDirection = "column";
		topDiv.style.overflow = "hidden";
		topDiv.style.backgroundColor = catColor ? hexToRgba(catColor, 0.2) : "#ffffff";
		topDiv.style.borderBottom = catColor ? ("1px solid " + hexToRgba(catColor, 0.4)) : "1px solid #e2e8f0";

		if (catName) {
			if (catImage) {
				var imgWrap = document.createElement("div");
				imgWrap.style.flex = "1";
				imgWrap.style.minHeight = "0";
				imgWrap.style.display = "flex";
				imgWrap.style.alignItems = "center";
				imgWrap.style.justifyContent = "center";
				imgWrap.style.overflow = "hidden";
				imgWrap.style.padding = "2px";
				var img = document.createElement("img");
				img.src = catImage;
				img.alt = catName;
				img.style.maxWidth = "100%";
				img.style.maxHeight = "100%";
				img.style.objectFit = "contain";
				imgWrap.appendChild(img);
				topDiv.appendChild(imgWrap);
			}
			var textWrap = document.createElement("div");
			textWrap.style.textAlign = "center";
			textWrap.style.fontWeight = "500";
			textWrap.style.lineHeight = "1.2";
			textWrap.style.flexShrink = catImage ? "0" : "0";
			if (catImage) {
				textWrap.style.padding = "0 2px 2px";
				textWrap.style.fontSize = "9px";
				textWrap.style.whiteSpace = "nowrap";
				textWrap.style.overflow = "hidden";
				textWrap.style.textOverflow = "ellipsis";
			} else {
				textWrap.style.flex = "1";
				textWrap.style.display = "flex";
				textWrap.style.alignItems = "center";
				textWrap.style.justifyContent = "center";
				textWrap.style.padding = "4px";
				textWrap.style.fontSize = "10px";
			}
			textWrap.textContent = catName;
			topDiv.appendChild(textWrap);
		} else {
			var emptyDiv = document.createElement("div");
			emptyDiv.style.flex = "1";
			emptyDiv.style.display = "flex";
			emptyDiv.style.alignItems = "center";
			emptyDiv.style.justifyContent = "center";
			emptyDiv.style.fontSize = "9px";
			emptyDiv.style.color = "#94a3b8";
			emptyDiv.textContent = "\u2014";
			topDiv.appendChild(emptyDiv);
		}

		cellRef.style.backgroundColor = catColor ? hexToRgba(catColor, 0.2) : "#ffffff";
		cellRef.style.borderColor = catColor || "#cbd5e1";
		cellRef.appendChild(topDiv);

		// Bottom portion: response dropdown
		if (responseLabels.length > 0) {
			var bottomDiv = document.createElement("div");
			bottomDiv.style.flexShrink = "0";
			bottomDiv.style.padding = "2px";
			var select = document.createElement("select");
			select.style.width = "100%";
			select.style.border = "1px solid #cbd5e1";
			select.style.borderRadius = "4px";
			select.style.backgroundColor = "#ffffff";
			select.style.padding = "2px 4px";
			select.style.fontSize = "9px";
			select.style.color = "#0f172a";
			select.style.outline = "none";

			var emptyOpt = document.createElement("option");
			emptyOpt.value = "";
			emptyOpt.textContent = "\u2014 react \u2014";
			select.appendChild(emptyOpt);

			responseLabels.forEach(function (lbl) {
				var opt = document.createElement("option");
				opt.value = lbl;
				opt.textContent = lbl;
				select.appendChild(opt);
			});

			select.value = experimentalResponses[key] || "";
			(function (k, sel) {
				sel.onchange = function () {
					if (!sel.value) {
						delete experimentalResponses[k];
					} else {
						experimentalResponses[k] = sel.value;
					}
					persistAll();
				};
			})(key, select);

			bottomDiv.appendChild(select);
			cellRef.appendChild(bottomDiv);
		}
	}

	function resetCellBaseStyles(cellRef, isCenterCell) {
		cellRef.style.display = "flex";
		cellRef.style.flexDirection = "column";
		cellRef.style.alignItems = "stretch";
		cellRef.style.justifyContent = "center";
		cellRef.style.overflow = "hidden";
		cellRef.style.backgroundColor = isCenterCell ? "#e0f2fe" : "#ffffff";
		cellRef.style.borderColor = isCenterCell ? "#38bdf8" : "#cbd5e1";
		cellRef.style.color = "#0f172a";
	}

	function renderCellContent(cellRef, catName, catColor, catImage) {
		cellRef.innerHTML = "";
		resetCellBaseStyles(cellRef, false);
		cellRef.style.backgroundColor = hexToRgba(catColor, 0.2);
		cellRef.style.borderColor = catColor;

		if (catImage) {
			var imgWrap = document.createElement("div");
			imgWrap.style.flex = "1";
			imgWrap.style.minHeight = "0";
			imgWrap.style.display = "flex";
			imgWrap.style.alignItems = "center";
			imgWrap.style.justifyContent = "center";
			imgWrap.style.overflow = "hidden";
			imgWrap.style.padding = "2px";

			var img = document.createElement("img");
			img.src = catImage;
			img.alt = catName;
			img.style.maxWidth = "100%";
			img.style.maxHeight = "100%";
			img.style.objectFit = "contain";
			imgWrap.appendChild(img);
			cellRef.appendChild(imgWrap);
		}

		var textWrap = document.createElement("div");
		textWrap.style.textAlign = "center";
		textWrap.style.lineHeight = "1.2";
		textWrap.style.fontWeight = "500";

		if (catImage) {
			textWrap.style.flexShrink = "0";
			textWrap.style.padding = "0 2px 2px";
			textWrap.style.fontSize = "9px";
			textWrap.style.whiteSpace = "nowrap";
			textWrap.style.overflow = "hidden";
			textWrap.style.textOverflow = "ellipsis";
		} else {
			textWrap.style.flex = "1";
			textWrap.style.display = "flex";
			textWrap.style.alignItems = "center";
			textWrap.style.justifyContent = "center";
			textWrap.style.padding = "4px";
			textWrap.style.fontSize = "10px";
		}

		textWrap.textContent = catName;
		cellRef.appendChild(textWrap);
	}

	function renderDropdownCell(cellRef, key, isCenterCell) {
		cellRef.innerHTML = "";
		resetCellBaseStyles(cellRef, isCenterCell);
		cellRef.style.padding = "4px";
		cellRef.style.gap = "4px";

		if (isCenterCell) {
			var centerLabel = document.createElement("div");
			centerLabel.textContent = cfg.layout.centerCellLabel || "Your House";
			centerLabel.style.fontSize = "10px";
			centerLabel.style.fontWeight = "600";
			centerLabel.style.textAlign = "center";
			centerLabel.style.lineHeight = "1.2";
			cellRef.appendChild(centerLabel);
		}

		var select = document.createElement("select");
		select.style.width = "100%";
		select.style.minWidth = "0";
		select.style.border = "1px solid #cbd5e1";
		select.style.borderRadius = "6px";
		select.style.backgroundColor = "#ffffff";
		select.style.padding = "4px 6px";
		select.style.fontSize = "10px";
		select.style.color = "#0f172a";

		var emptyOption = document.createElement("option");
		emptyOption.value = "";
		emptyOption.textContent = "Choose label";
		select.appendChild(emptyOption);

		categories.forEach(function (cat) {
			var option = document.createElement("option");
			option.value = cat;
			option.textContent = cat;
			select.appendChild(option);
		});

		select.value = assignments[key] || "";
		select.onchange = function () {
			if (!select.value) {
				delete assignments[key];
			} else {
				assignments[key] = select.value;
			}
			persistAll();
			renderCell(cellRef, key, isCenterCell);
		};

		cellRef.appendChild(select);
	}

	function renderCell(cellRef, key, isCenterCell) {
		if (isExperimental) {
			renderExperimentalCell(cellRef, key, isCenterCell);
			return;
		}

		var assigned = assignments[key];
		if (assigned) {
			var meta = getCategoryMeta(assigned);
			renderCellContent(cellRef, assigned, meta.color || "#60a5fa", meta.imageUrl || "");
			return;
		}

		if (allowInteraction && selectionMode === "dropdown" && !isCenterCell) {
			renderDropdownCell(cellRef, key, isCenterCell);
			return;
		}

		cellRef.innerHTML = "";
		resetCellBaseStyles(cellRef, isCenterCell);

		if (isCenterCell) {
			var label = document.createElement("div");
			label.textContent = cfg.layout.centerCellLabel || "Your House";
			label.style.width = "100%";
			label.style.padding = "4px";
			label.style.fontSize = "10px";
			label.style.fontWeight = "500";
			label.style.textAlign = "center";
			label.style.lineHeight = "1.2";
			cellRef.appendChild(label);
		}
	}

	function createCategoryChip(catName, isClear) {
		var meta = getCategoryMeta(catName);
		var color = isClear ? "#94a3b8" : (meta.color || "#60a5fa");
		var chip = document.createElement("button");
		chip.type = "button";
		chip.textContent = catName;
		chip.style.display = "inline-flex";
		chip.style.alignItems = "center";
		chip.style.justifyContent = "center";
		chip.style.borderRadius = "9999px";
		chip.style.border = "1px solid #e2e8f0";
		chip.style.padding = "4px 10px";
		chip.style.fontSize = "11px";
		chip.style.fontWeight = "500";
		chip.style.backgroundColor = isClear ? "#ffffff" : hexToRgba(color, 0.12);
		chip.style.color = "#334155";
		chip.style.cursor = "grab";
		chip.draggable = true;

		chip.ondragstart = function (event) {
			draggedCategory = isClear ? "__CLEAR__" : catName;
			if (event.dataTransfer) {
				event.dataTransfer.setData("text/plain", draggedCategory);
				event.dataTransfer.effectAllowed = "move";
			}
		};

		chip.ondragend = function () {
			draggedCategory = null;
		};

		return chip;
	}

	var questionText = document.createElement("p");
	questionText.textContent = cfg.layout.questionText;
	questionText.style.marginBottom = "8px";
	container.appendChild(questionText);

	if (!isExperimental && allowInteraction && categories.length > 0 && selectionMode === "paint") {
		var toolbar = document.createElement("div");
		toolbar.style.display = "flex";
		toolbar.style.flexWrap = "wrap";
		toolbar.style.alignItems = "center";
		toolbar.style.gap = "4px";
		toolbar.style.marginBottom = "6px";

		var toolbarLabel = document.createElement("span");
		toolbarLabel.textContent = "Placing:";
		toolbarLabel.style.fontSize = "11px";
		toolbarLabel.style.fontWeight = "600";
		toolbarLabel.style.color = "#475569";
		toolbar.appendChild(toolbarLabel);

		categories.forEach(function (cat) {
			var meta = getCategoryMeta(cat);
			var color = meta.color || "#60a5fa";
			var btn = document.createElement("button");
			btn.type = "button";
			btn.dataset.cat = cat;
			btn.style.display = "inline-flex";
			btn.style.alignItems = "center";
			btn.style.gap = "4px";
			btn.style.borderRadius = "9999px";
			btn.style.border = cat === activeCategory ? "1px solid " + color : "1px solid #e2e8f0";
			btn.style.padding = "2px 8px";
			btn.style.fontSize = "11px";
			btn.style.backgroundColor = cat === activeCategory ? hexToRgba(color, 0.15) : "#ffffff";
			btn.style.color = "#334155";
			btn.style.cursor = "pointer";

			var dot = document.createElement("span");
			dot.style.display = "inline-block";
			dot.style.width = "8px";
			dot.style.height = "8px";
			dot.style.borderRadius = "9999px";
			dot.style.backgroundColor = color;
			dot.style.flexShrink = "0";
			btn.appendChild(dot);
			btn.appendChild(document.createTextNode(cat));

			btn.onclick = function () {
				activeCategory = cat;
				Array.prototype.forEach.call(toolbar.querySelectorAll("button"), function (other) {
					var otherMeta = getCategoryMeta(other.dataset.cat);
					var otherColor = otherMeta.color || "#60a5fa";
					var isActive = other.dataset.cat === cat;
					other.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#ffffff";
					other.style.borderColor = isActive ? otherColor : "#e2e8f0";
				});
			};

			toolbar.appendChild(btn);
		});

		container.appendChild(toolbar);
	}

	if (!isExperimental && allowInteraction && categories.length > 0 && selectionMode === "dragdrop") {
		var dragHelp = document.createElement("div");
		dragHelp.style.display = "flex";
		dragHelp.style.flexDirection = "column";
		dragHelp.style.gap = "6px";
		dragHelp.style.marginBottom = "8px";

		var dragLabel = document.createElement("span");
		dragLabel.textContent = "Drag a label onto a cell:";
		dragLabel.style.fontSize = "11px";
		dragLabel.style.fontWeight = "600";
		dragLabel.style.color = "#475569";
		dragHelp.appendChild(dragLabel);

		var dragTray = document.createElement("div");
		dragTray.style.display = "flex";
		dragTray.style.flexWrap = "wrap";
		dragTray.style.gap = "6px";

		categories.forEach(function (cat) {
			dragTray.appendChild(createCategoryChip(cat, false));
		});
		dragTray.appendChild(createCategoryChip("Clear cell", true));

		dragHelp.appendChild(dragTray);
		container.appendChild(dragHelp);
	}

	var totalCellsCount = cfg.layout.rows * cfg.layout.cols;
	var centerRowVal = cfg.layout.centerRow || Math.ceil(cfg.layout.rows / 2);
	var centerColVal = cfg.layout.centerCol || Math.ceil(cfg.layout.cols / 2);
	computePrefills(totalCellsCount, centerRowVal, centerColVal);

	var wrapper = document.createElement("div");
	wrapper.style.width = cfg.tuning.previewWidth + "px";
	wrapper.style.height = cfg.tuning.previewHeight + "px";
	wrapper.style.border = "1px solid #cbd5e1";
	wrapper.style.backgroundColor = "#f8fafc";
	wrapper.style.overflow = "auto";
	wrapper.style.borderRadius = "0.75rem";
	wrapper.style.position = "relative";

	if (cfg.layout.backgroundImageUrl) {
		wrapper.style.backgroundImage = "url(" + cfg.layout.backgroundImageUrl + ")";
		wrapper.style.backgroundRepeat = "no-repeat";
		wrapper.style.backgroundPosition = "center";
		wrapper.style.backgroundSize = "contain";
	}

	var grid = document.createElement("div");
	grid.style.display = "grid";
	grid.style.width = "100%";
	grid.style.height = "100%";
	grid.style.boxSizing = "border-box";
	grid.style.gridTemplateColumns = "repeat(" + cfg.layout.cols + ", minmax(0, 1fr))";
	grid.style.gridTemplateRows = "repeat(" + cfg.layout.rows + ", minmax(0, 1fr))";
	grid.style.gap = cfg.tuning.gridGap + "px";
	grid.style.padding = cfg.tuning.gridPadding + "px";

	for (var i = 0; i < totalCellsCount; i++) {
		var row = Math.floor(i / cfg.layout.cols) + 1;
		var col = (i % cfg.layout.cols) + 1;
		var isCenter = cfg.layout.includeCenterCell && row === centerRowVal && col === centerColVal;
		var key = "r" + row + "-c" + col;
		var cell = document.createElement("div");
		cell.style.borderRadius = "0.375rem";
		cell.style.border = "1px solid #cbd5e1";
		cell.style.minWidth = "0";
		cell.style.minHeight = "0";
		cell.style.fontSize = "10px";
		cell.style.fontWeight = "500";
		cell.style.transition = "border-color 120ms ease, background-color 120ms ease";

		renderCell(cell, key, isCenter);

		if (!isExperimental && allowInteraction && selectionMode === "paint") {
			cell.style.cursor = isCenter ? "default" : "pointer";
			(function (cellRef, cellKey, isCenterCell) {
				cellRef.onclick = function () {
					if (isCenterCell) return;
					if (!activeCategory) return;
					if (assignments[cellKey] === activeCategory) {
						delete assignments[cellKey];
					} else {
						assignments[cellKey] = activeCategory;
					}
					persistAll();
					renderCell(cellRef, cellKey, isCenterCell);
				};
			})(cell, key, isCenter);
		}

		if (!isExperimental && allowInteraction && selectionMode === "dragdrop") {
			(function (cellRef, cellKey, isCenterCell) {
				cellRef.style.cursor = isCenterCell ? "default" : "copy";
				cellRef.ondragover = function (event) {
					if (isCenterCell) return;
					event.preventDefault();
					if (event.dataTransfer) {
						event.dataTransfer.dropEffect = "move";
					}
					cellRef.style.borderColor = "#0f172a";
					cellRef.style.backgroundColor = "#e2e8f0";
				};
				cellRef.ondragleave = function () {
					renderCell(cellRef, cellKey, isCenterCell);
				};
				cellRef.ondrop = function (event) {
					if (isCenterCell) return;
					event.preventDefault();
					var dropped = draggedCategory;
					if (!dropped && event.dataTransfer) {
						dropped = event.dataTransfer.getData("text/plain");
					}
					if (!dropped) {
						renderCell(cellRef, cellKey, isCenterCell);
						return;
					}
					if (dropped === "__CLEAR__") {
						delete assignments[cellKey];
					} else {
						assignments[cellKey] = dropped;
					}
					persistAll();
					renderCell(cellRef, cellKey, isCenterCell);
				};
			})(cell, key, isCenter);
		}

		grid.appendChild(cell);
	}

	wrapper.appendChild(grid);
	container.appendChild(wrapper);

	var controls = document.createElement("div");
	controls.style.marginTop = "10px";
	controls.style.display = "flex";
	controls.style.justifyContent = "flex-end";

	var nextBtn = document.createElement("button");
	nextBtn.type = "button";
	nextBtn.textContent = "Next";
	nextBtn.style.border = "1px solid #0f172a";
	nextBtn.style.backgroundColor = "#0f172a";
	nextBtn.style.color = "#ffffff";
	nextBtn.style.borderRadius = "8px";
	nextBtn.style.padding = "8px 12px";
	nextBtn.style.fontSize = "12px";
	nextBtn.style.fontWeight = "600";
	nextBtn.style.cursor = "pointer";
	nextBtn.onclick = function () {
		question.clickNextButton();
	};

	controls.appendChild(nextBtn);
	container.appendChild(controls);
});

Qualtrics.SurveyEngine.addOnUnload(function()
{
	/* Optional: code to run when the page is unloaded */

});`;
}

export function buildQualtricsMultiQuestionSnippet(
  items: QualtricsMultiQuestionItem[],
): string {
  const payload = items.map((item) => ({
    title: item.title,
    embeddedDataField: sanitizeEmbeddedDataField(
      item.embeddedDataField,
      "GridAssignments",
    ),
    layout: item.config.layout,
    tuning: item.config.tuning,
    survey: item.config.survey,
  }));

  const payloadJson = JSON.stringify(payload, null, 2);

  return `Qualtrics.SurveyEngine.addOnload(function()
{
	/* Optional: code to run when the page loads */

});

Qualtrics.SurveyEngine.addOnReady(function()
{
	var question = this;
	var container = this.getQuestionTextContainer();
	if (!container) return;

	container.innerHTML = "";

	var steps = ${payloadJson};
	if (!Array.isArray(steps) || steps.length === 0) {
		container.textContent = "No exported questions were provided.";
		return;
	}

	var currentStepIndex = 0;
	var allAssignments = {};

	function hexToRgba(hex, alpha) {
		var r = parseInt(hex.slice(1, 3), 16);
		var g = parseInt(hex.slice(3, 5), 16);
		var b = parseInt(hex.slice(5, 7), 16);
		return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
	}

	function renderStep() {
		var step = steps[currentStepIndex];
		var cfg = {
			layout: step.layout,
			tuning: step.tuning,
			survey: step.survey
		};
		var surveyCfg = cfg.survey || {};
		var categories = [];
		var allowInteraction = !!surveyCfg.allowInteraction;
		var selectionMode = surveyCfg.selectionMode || "paint";
		var activeCategory = null;
		var draggedCategory = null;
		var assignments = allAssignments[step.embeddedDataField] || {};
		allAssignments[step.embeddedDataField] = assignments;

		if (surveyCfg.categoriesCsv) {
			categories = surveyCfg.categoriesCsv
				.split(",")
				.map(function (c) { return c.trim(); })
				.filter(function (c) { return c.length > 0; });
		}

		if (categories.length > 0) {
			activeCategory = categories[0];
		}

		function getCategoryMeta(catName) {
			if (!surveyCfg.categoryMeta) return {};
			return surveyCfg.categoryMeta[catName] || {};
		}

		function persistAssignments() {
			Qualtrics.SurveyEngine.setEmbeddedData(step.embeddedDataField, JSON.stringify(assignments));
		}

		function resetCellBaseStyles(cellRef, isCenterCell) {
			cellRef.style.display = "flex";
			cellRef.style.flexDirection = "column";
			cellRef.style.alignItems = "stretch";
			cellRef.style.justifyContent = "center";
			cellRef.style.overflow = "hidden";
			cellRef.style.backgroundColor = isCenterCell ? "#e0f2fe" : "#ffffff";
			cellRef.style.borderColor = isCenterCell ? "#38bdf8" : "#cbd5e1";
			cellRef.style.color = "#0f172a";
		}

		function renderCellContent(cellRef, catName, catColor, catImage) {
			cellRef.innerHTML = "";
			resetCellBaseStyles(cellRef, false);
			cellRef.style.backgroundColor = hexToRgba(catColor, 0.2);
			cellRef.style.borderColor = catColor;

			if (catImage) {
				var imgWrap = document.createElement("div");
				imgWrap.style.flex = "1";
				imgWrap.style.minHeight = "0";
				imgWrap.style.display = "flex";
				imgWrap.style.alignItems = "center";
				imgWrap.style.justifyContent = "center";
				imgWrap.style.overflow = "hidden";
				imgWrap.style.padding = "2px";

				var img = document.createElement("img");
				img.src = catImage;
				img.alt = catName;
				img.style.maxWidth = "100%";
				img.style.maxHeight = "100%";
				img.style.objectFit = "contain";
				imgWrap.appendChild(img);
				cellRef.appendChild(imgWrap);
			}

			var textWrap = document.createElement("div");
			textWrap.style.textAlign = "center";
			textWrap.style.lineHeight = "1.2";
			textWrap.style.fontWeight = "500";

			if (catImage) {
				textWrap.style.flexShrink = "0";
				textWrap.style.padding = "0 2px 2px";
				textWrap.style.fontSize = "9px";
				textWrap.style.whiteSpace = "nowrap";
				textWrap.style.overflow = "hidden";
				textWrap.style.textOverflow = "ellipsis";
			} else {
				textWrap.style.flex = "1";
				textWrap.style.display = "flex";
				textWrap.style.alignItems = "center";
				textWrap.style.justifyContent = "center";
				textWrap.style.padding = "4px";
				textWrap.style.fontSize = "10px";
			}

			textWrap.textContent = catName;
			cellRef.appendChild(textWrap);
		}

		function renderDropdownCell(cellRef, key, isCenterCell) {
			cellRef.innerHTML = "";
			resetCellBaseStyles(cellRef, isCenterCell);
			cellRef.style.padding = "4px";
			cellRef.style.gap = "4px";

			if (isCenterCell) {
				var centerLabel = document.createElement("div");
				centerLabel.textContent = cfg.layout.centerCellLabel || "Your House";
				centerLabel.style.fontSize = "10px";
				centerLabel.style.fontWeight = "600";
				centerLabel.style.textAlign = "center";
				centerLabel.style.lineHeight = "1.2";
				cellRef.appendChild(centerLabel);
			}

			var select = document.createElement("select");
			select.style.width = "100%";
			select.style.minWidth = "0";
			select.style.border = "1px solid #cbd5e1";
			select.style.borderRadius = "6px";
			select.style.backgroundColor = "#ffffff";
			select.style.padding = "4px 6px";
			select.style.fontSize = "10px";
			select.style.color = "#0f172a";

			var emptyOption = document.createElement("option");
			emptyOption.value = "";
			emptyOption.textContent = "Choose label";
			select.appendChild(emptyOption);

			categories.forEach(function (cat) {
				var option = document.createElement("option");
				option.value = cat;
				option.textContent = cat;
				select.appendChild(option);
			});

			select.value = assignments[key] || "";
			select.onchange = function () {
				if (!select.value) {
					delete assignments[key];
				} else {
					assignments[key] = select.value;
				}
				persistAssignments();
				renderCell(cellRef, key, isCenterCell);
			};

			cellRef.appendChild(select);
		}

		function renderCell(cellRef, key, isCenterCell) {
			var assigned = assignments[key];
			if (assigned) {
				var meta = getCategoryMeta(assigned);
				renderCellContent(cellRef, assigned, meta.color || "#60a5fa", meta.imageUrl || "");
				return;
			}

			if (allowInteraction && selectionMode === "dropdown" && !isCenterCell) {
				renderDropdownCell(cellRef, key, isCenterCell);
				return;
			}

			cellRef.innerHTML = "";
			resetCellBaseStyles(cellRef, isCenterCell);

			if (isCenterCell) {
				var label = document.createElement("div");
				label.textContent = cfg.layout.centerCellLabel || "Your House";
				label.style.width = "100%";
				label.style.padding = "4px";
				label.style.fontSize = "10px";
				label.style.fontWeight = "500";
				label.style.textAlign = "center";
				label.style.lineHeight = "1.2";
				cellRef.appendChild(label);
			}
		}

		function createCategoryChip(catName, isClear) {
			var meta = getCategoryMeta(catName);
			var color = isClear ? "#94a3b8" : (meta.color || "#60a5fa");
			var chip = document.createElement("button");
			chip.type = "button";
			chip.textContent = catName;
			chip.style.display = "inline-flex";
			chip.style.alignItems = "center";
			chip.style.justifyContent = "center";
			chip.style.borderRadius = "9999px";
			chip.style.border = "1px solid #e2e8f0";
			chip.style.padding = "4px 10px";
			chip.style.fontSize = "11px";
			chip.style.fontWeight = "500";
			chip.style.backgroundColor = isClear ? "#ffffff" : hexToRgba(color, 0.12);
			chip.style.color = "#334155";
			chip.style.cursor = "grab";
			chip.draggable = true;

			chip.ondragstart = function (event) {
				draggedCategory = isClear ? "__CLEAR__" : catName;
				if (event.dataTransfer) {
					event.dataTransfer.setData("text/plain", draggedCategory);
					event.dataTransfer.effectAllowed = "move";
				}
			};

			chip.ondragend = function () {
				draggedCategory = null;
			};

			return chip;
		}

		container.innerHTML = "";

		var progress = document.createElement("div");
		progress.style.marginBottom = "8px";
		progress.style.fontSize = "12px";
		progress.style.fontWeight = "600";
		progress.style.color = "#334155";
		progress.textContent =
			"Question " + (currentStepIndex + 1) + " of " + steps.length + ": " + (step.title || "Grid question");
		container.appendChild(progress);

		var questionText = document.createElement("p");
		questionText.textContent = cfg.layout.questionText;
		questionText.style.marginBottom = "8px";
		container.appendChild(questionText);

		if (allowInteraction && categories.length > 0 && selectionMode === "paint") {
			var toolbar = document.createElement("div");
			toolbar.style.display = "flex";
			toolbar.style.flexWrap = "wrap";
			toolbar.style.alignItems = "center";
			toolbar.style.gap = "4px";
			toolbar.style.marginBottom = "6px";

			var toolbarLabel = document.createElement("span");
			toolbarLabel.textContent = "Placing:";
			toolbarLabel.style.fontSize = "11px";
			toolbarLabel.style.fontWeight = "600";
			toolbarLabel.style.color = "#475569";
			toolbar.appendChild(toolbarLabel);

			categories.forEach(function (cat) {
				var meta = getCategoryMeta(cat);
				var color = meta.color || "#60a5fa";
				var btn = document.createElement("button");
				btn.type = "button";
				btn.dataset.cat = cat;
				btn.style.display = "inline-flex";
				btn.style.alignItems = "center";
				btn.style.gap = "4px";
				btn.style.borderRadius = "9999px";
				btn.style.border = cat === activeCategory ? "1px solid " + color : "1px solid #e2e8f0";
				btn.style.padding = "2px 8px";
				btn.style.fontSize = "11px";
				btn.style.backgroundColor = cat === activeCategory ? hexToRgba(color, 0.15) : "#ffffff";
				btn.style.color = "#334155";
				btn.style.cursor = "pointer";

				var dot = document.createElement("span");
				dot.style.display = "inline-block";
				dot.style.width = "8px";
				dot.style.height = "8px";
				dot.style.borderRadius = "9999px";
				dot.style.backgroundColor = color;
				dot.style.flexShrink = "0";
				btn.appendChild(dot);
				btn.appendChild(document.createTextNode(cat));

				btn.onclick = function () {
					activeCategory = cat;
					Array.prototype.forEach.call(toolbar.querySelectorAll("button"), function (other) {
						var otherMeta = getCategoryMeta(other.dataset.cat);
						var otherColor = otherMeta.color || "#60a5fa";
						var isActive = other.dataset.cat === cat;
						other.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#ffffff";
						other.style.borderColor = isActive ? otherColor : "#e2e8f0";
					});
				};

				toolbar.appendChild(btn);
			});

			container.appendChild(toolbar);
		}

		if (allowInteraction && categories.length > 0 && selectionMode === "dragdrop") {
			var dragHelp = document.createElement("div");
			dragHelp.style.display = "flex";
			dragHelp.style.flexDirection = "column";
			dragHelp.style.gap = "6px";
			dragHelp.style.marginBottom = "8px";

			var dragLabel = document.createElement("span");
			dragLabel.textContent = "Drag a label onto a cell:";
			dragLabel.style.fontSize = "11px";
			dragLabel.style.fontWeight = "600";
			dragLabel.style.color = "#475569";
			dragHelp.appendChild(dragLabel);

			var dragTray = document.createElement("div");
			dragTray.style.display = "flex";
			dragTray.style.flexWrap = "wrap";
			dragTray.style.gap = "6px";

			categories.forEach(function (cat) {
				dragTray.appendChild(createCategoryChip(cat, false));
			});
			dragTray.appendChild(createCategoryChip("Clear cell", true));

			dragHelp.appendChild(dragTray);
			container.appendChild(dragHelp);
		}

		var wrapper = document.createElement("div");
		wrapper.style.width = cfg.tuning.previewWidth + "px";
		wrapper.style.height = cfg.tuning.previewHeight + "px";
		wrapper.style.border = "1px solid #cbd5e1";
		wrapper.style.backgroundColor = "#f8fafc";
		wrapper.style.overflow = "auto";
		wrapper.style.borderRadius = "0.75rem";
		wrapper.style.position = "relative";

		if (cfg.layout.backgroundImageUrl) {
			wrapper.style.backgroundImage = "url(" + cfg.layout.backgroundImageUrl + ")";
			wrapper.style.backgroundRepeat = "no-repeat";
			wrapper.style.backgroundPosition = "center";
			wrapper.style.backgroundSize = "contain";
		}

		var grid = document.createElement("div");
		grid.style.display = "grid";
		grid.style.width = "100%";
		grid.style.height = "100%";
		grid.style.boxSizing = "border-box";
		grid.style.gridTemplateColumns = "repeat(" + cfg.layout.cols + ", minmax(0, 1fr))";
		grid.style.gridTemplateRows = "repeat(" + cfg.layout.rows + ", minmax(0, 1fr))";
		grid.style.gap = cfg.tuning.gridGap + "px";
		grid.style.padding = cfg.tuning.gridPadding + "px";

		var totalCells = cfg.layout.rows * cfg.layout.cols;
		var centerRow = cfg.layout.centerRow || Math.ceil(cfg.layout.rows / 2);
		var centerCol = cfg.layout.centerCol || Math.ceil(cfg.layout.cols / 2);

		for (var i = 0; i < totalCells; i++) {
			var row = Math.floor(i / cfg.layout.cols) + 1;
			var col = (i % cfg.layout.cols) + 1;
			var isCenter = cfg.layout.includeCenterCell && row === centerRow && col === centerCol;
			var key = "r" + row + "-c" + col;
			var cell = document.createElement("div");
			cell.style.borderRadius = "0.375rem";
			cell.style.border = "1px solid #cbd5e1";
			cell.style.minWidth = "0";
			cell.style.minHeight = "0";
			cell.style.fontSize = "10px";
			cell.style.fontWeight = "500";
			cell.style.transition = "border-color 120ms ease, background-color 120ms ease";

			renderCell(cell, key, isCenter);

			if (allowInteraction && selectionMode === "paint") {
				cell.style.cursor = isCenter ? "default" : "pointer";
				(function (cellRef, cellKey, isCenterCell) {
					cellRef.onclick = function () {
						if (isCenterCell) return;
						if (!activeCategory) return;
						if (assignments[cellKey] === activeCategory) {
							delete assignments[cellKey];
						} else {
							assignments[cellKey] = activeCategory;
						}
						persistAssignments();
						renderCell(cellRef, cellKey, isCenterCell);
					};
				})(cell, key, isCenter);
			}

			if (allowInteraction && selectionMode === "dragdrop") {
				(function (cellRef, cellKey, isCenterCell) {
					cellRef.style.cursor = isCenterCell ? "default" : "copy";
					cellRef.ondragover = function (event) {
						if (isCenterCell) return;
						event.preventDefault();
						if (event.dataTransfer) {
							event.dataTransfer.dropEffect = "move";
						}
						cellRef.style.borderColor = "#0f172a";
						cellRef.style.backgroundColor = "#e2e8f0";
					};
					cellRef.ondragleave = function () {
						renderCell(cellRef, cellKey, isCenterCell);
					};
					cellRef.ondrop = function (event) {
						if (isCenterCell) return;
						event.preventDefault();
						var dropped = draggedCategory;
						if (!dropped && event.dataTransfer) {
							dropped = event.dataTransfer.getData("text/plain");
						}
						if (!dropped) {
							renderCell(cellRef, cellKey, isCenterCell);
							return;
						}
						if (dropped === "__CLEAR__") {
							delete assignments[cellKey];
						} else {
							assignments[cellKey] = dropped;
						}
						persistAssignments();
						renderCell(cellRef, cellKey, isCenterCell);
					};
				})(cell, key, isCenter);
			}

			grid.appendChild(cell);
		}

		wrapper.appendChild(grid);
		container.appendChild(wrapper);

		var controls = document.createElement("div");
		controls.style.marginTop = "10px";
		controls.style.display = "flex";
		controls.style.justifyContent = "space-between";
		controls.style.alignItems = "center";

		var fieldLabel = document.createElement("span");
		fieldLabel.style.fontSize = "11px";
		fieldLabel.style.color = "#64748b";
		fieldLabel.textContent = "Embedded field: " + step.embeddedDataField;
		controls.appendChild(fieldLabel);

		var nextBtn = document.createElement("button");
		nextBtn.type = "button";
		nextBtn.textContent = currentStepIndex < steps.length - 1 ? "Next question" : "Finish";
		nextBtn.style.border = "1px solid #0f172a";
		nextBtn.style.backgroundColor = "#0f172a";
		nextBtn.style.color = "#ffffff";
		nextBtn.style.borderRadius = "8px";
		nextBtn.style.padding = "8px 12px";
		nextBtn.style.fontSize = "12px";
		nextBtn.style.fontWeight = "600";
		nextBtn.style.cursor = "pointer";
		nextBtn.onclick = function () {
			persistAssignments();
			if (currentStepIndex < steps.length - 1) {
				currentStepIndex += 1;
				renderStep();
				return;
			}
			question.clickNextButton();
		};

		controls.appendChild(nextBtn);
		container.appendChild(controls);
	}

	renderStep();
});

Qualtrics.SurveyEngine.addOnUnload(function()
{
	/* Optional: code to run when the page is unloaded */

});`;
}
