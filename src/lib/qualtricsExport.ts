import { GridConfig } from "../grid-types";

export interface QualtricsExportOptions {
  /** Embedded data field used in standard (non-experimental) mode. */
  embeddedDataField?: string;
  /** Embedded data field for experimental pre-fills (what was shown). */
  prefillsField?: string;
  /** Embedded data field for experimental responses (what was selected). */
  responsesField?: string;
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
  const prefillsField = options.prefillsField ?? "GridPrefills";
  const responsesField = options.responsesField ?? "GridResponses";
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
	container.style.fontFamily = "'Hanken Grotesk', sans-serif";
	container.style.color = "#2a241c";

	if (!document.getElementById("griddy-fonts")) {
		var fontLink = document.createElement("link");
		fontLink.id = "griddy-fonts";
		fontLink.rel = "stylesheet";
		fontLink.href = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap";
		document.head.appendChild(fontLink);
	}

	var cfg = ${cfgJson};
	var surveyCfg = cfg.survey || {};
	var categories = [];
	var allowInteraction = !!surveyCfg.allowInteraction;
	var selectionMode = surveyCfg.selectionMode || "paint";
	var assignments = {};
	var activeCategory = null;
	var draggedCategory = null;
	var activeResponseLabel = null;
	var draggedResponseLabel = null;

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
	if (responseLabels.length > 0) {
		activeResponseLabel = responseLabels[0];
	}
	var prefills = {};
	var experimentalResponses = {};

	// Structural barriers (walls): blocked cells are non-interactive in every mode.
	var blockedCells = (cfg.layout && cfg.layout.blockedCells) || {};
	var barrierMeta = (cfg.layout && cfg.layout.barrierMeta) || {};

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

	function getBarrierMeta(name) {
		return barrierMeta[name] || {};
	}

	// Append a background-colored filler positioned with fixed pixel offsets.
	// css keys are among top/bottom/left/right/width/height (all "<n>px").
	function makeFiller(color, css) {
		var f = document.createElement("div");
		f.style.position = "absolute";
		f.style.backgroundColor = color;
		for (var k in css) { f.style[k] = css[k]; }
		return f;
	}

	// Render a blocked cell (barrier/wall). Cells that share an EDGE with another
	// blocked cell of the same type merge into one continuous shape (diagonal /
	// corner-only neighbors do NOT connect). We square the shared corners and
	// bridge the grid gap with plain background-colored filler elements sized in
	// fixed pixels — no percentages, shadows, or margins, which don't survive
	// Qualtrics' embedded rendering.
	function renderBlockedCell(cellRef, row, col, name) {
		cellRef.innerHTML = "";
		var meta = getBarrierMeta(name);
		var color = meta.color || "#94a3b8";
		var image = meta.imageUrl || "";
		var gap = cfg.tuning.gridGap;
		var g = gap + "px";
		var ng = -gap + "px";
		var radius = 6; // matches the loop's 0.375rem cell radius
		function at(r, c) { return blockedCells["r" + r + "-c" + c] === name; }
		var cUp = at(row - 1, col);
		var cDown = at(row + 1, col);
		var cLeft = at(row, col - 1);
		var cRight = at(row, col + 1);

		cellRef.style.position = "relative";
		cellRef.style.border = "none";
		cellRef.style.backgroundColor = color;
		cellRef.style.borderTopLeftRadius = (cUp || cLeft ? 0 : radius) + "px";
		cellRef.style.borderTopRightRadius = (cUp || cRight ? 0 : radius) + "px";
		cellRef.style.borderBottomLeftRadius = (cDown || cLeft ? 0 : radius) + "px";
		cellRef.style.borderBottomRightRadius = (cDown || cRight ? 0 : radius) + "px";
		cellRef.style.zIndex = "1";

		// Edge bridges (each shared edge filled once, by the left/top cell) and
		// inner-corner fills (only when both bracketing edges connect, so
		// corner-only diagonal neighbors never join).
		if (cRight) cellRef.appendChild(makeFiller(color, { top: "0", bottom: "0", right: ng, width: g }));
		if (cDown) cellRef.appendChild(makeFiller(color, { left: "0", right: "0", bottom: ng, height: g }));
		if (cRight && cDown) cellRef.appendChild(makeFiller(color, { right: ng, width: g, bottom: ng, height: g }));
		if (cLeft && cDown) cellRef.appendChild(makeFiller(color, { left: ng, width: g, bottom: ng, height: g }));
		if (cRight && cUp) cellRef.appendChild(makeFiller(color, { right: ng, width: g, top: ng, height: g }));
		if (cLeft && cUp) cellRef.appendChild(makeFiller(color, { left: ng, width: g, top: ng, height: g }));

		if (image) {
			var img = document.createElement("img");
			img.src = image;
			img.alt = name;
			img.style.position = "absolute";
			img.style.top = "0";
			img.style.left = "0";
			img.style.width = "100%";
			img.style.height = "100%";
			img.style.objectFit = "cover";
			img.style.borderRadius = "inherit";
			img.style.zIndex = "1";
			cellRef.appendChild(img);
		}
	}

	function getResponseMeta(lbl) {
		if (!expCfg.responseLabelMeta) return {};
		return expCfg.responseLabelMeta[lbl] || {};
	}

	function persistAll() {
		if (isExperimental) {
			Qualtrics.SurveyEngine.setEmbeddedData(${JSON.stringify(prefillsField)}, JSON.stringify(prefills));
			Qualtrics.SurveyEngine.setEmbeddedData(${JSON.stringify(responsesField)}, JSON.stringify(experimentalResponses));
		} else {
			Qualtrics.SurveyEngine.setEmbeddedData(${JSON.stringify(embeddedDataField)}, JSON.stringify(assignments));
		}
	}

	function computePrefills(totalCells, centerRow, centerCol) {
		if (!isExperimental) return;
		if (prefillMode === "fixed") {
			Object.keys(fixedAssignments).forEach(function (k) {
				if (blockedCells[k]) return;
				prefills[k] = fixedAssignments[k];
			});
		} else if (prefillMode === "shuffle") {
			var keys = Object.keys(fixedAssignments).filter(function (k) {
				return !blockedCells[k];
			});
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
					if (blockedCells[k]) continue;
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
		topDiv.style.backgroundColor = catColor ? hexToRgba(catColor, 0.2) : "#fbf8f1";
		topDiv.style.borderBottom = catColor ? ("1px solid " + hexToRgba(catColor, 0.4)) : "1px solid #e2dccf";

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
				// With an image, the label sits at the top of the cell so a
				// reaction's bottom label never collides with it.
				textWrap.style.padding = "2px 2px 0";
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
			if (catImage) {
				topDiv.insertBefore(textWrap, topDiv.firstChild);
			} else {
				topDiv.appendChild(textWrap);
			}
		} else {
			var emptyDiv = document.createElement("div");
			emptyDiv.style.flex = "1";
			emptyDiv.style.display = "flex";
			emptyDiv.style.alignItems = "center";
			emptyDiv.style.justifyContent = "center";
			emptyDiv.style.fontSize = "9px";
			emptyDiv.style.color = "#a0967f";
			emptyDiv.textContent = "\u2014";
			topDiv.appendChild(emptyDiv);
		}

		cellRef.style.backgroundColor = catColor ? hexToRgba(catColor, 0.2) : "#fbf8f1";
		cellRef.style.borderColor = catColor || "#e2dccf";
		cellRef.appendChild(topDiv);

		// Bottom portion: how the respondent reacts depends on selectionMode.
		// dropdown -> per-cell <select>; paint/dragdrop -> the cell itself is the
		// target and we just render the placed reaction as a colored band.
		if (responseLabels.length > 0 && selectionMode !== "dropdown") {
			var placed = experimentalResponses[key];
			if (placed) {
				var respMeta = getResponseMeta(placed);
				var respColor = respMeta.color || "#8b5cf6";
				var respImage = respMeta.imageUrl || "";
				cellRef.style.borderColor = respColor;
				if (respImage) {
					// Reaction has an image: layer it full-cell on top of the
					// pre-filled stimulus (transparent PNGs let the stimulus show
					// through), with a small text label strip at the bottom.
					cellRef.style.position = "relative";
					var overlay = document.createElement("img");
					overlay.src = respImage;
					overlay.alt = placed;
					overlay.style.position = "absolute";
					overlay.style.top = "0";
					overlay.style.left = "0";
					overlay.style.width = "100%";
					overlay.style.height = "100%";
					overlay.style.objectFit = "contain";
					overlay.style.zIndex = "10";
					cellRef.appendChild(overlay);

					var oLabel = document.createElement("div");
					oLabel.textContent = placed;
					oLabel.style.position = "absolute";
					oLabel.style.bottom = "0";
					oLabel.style.left = "0";
					oLabel.style.right = "0";
					oLabel.style.textAlign = "center";
					oLabel.style.fontSize = "8px";
					oLabel.style.fontWeight = "600";
					oLabel.style.lineHeight = "1.2";
					oLabel.style.whiteSpace = "nowrap";
					oLabel.style.overflow = "hidden";
					oLabel.style.textOverflow = "ellipsis";
					oLabel.style.padding = "0 2px 1px";
					oLabel.style.color = respColor;
					oLabel.style.backgroundColor = hexToRgba(respColor, 0.15);
					oLabel.style.borderTop = "1px solid " + hexToRgba(respColor, 0.4);
					oLabel.style.zIndex = "11";
					cellRef.appendChild(oLabel);
				} else {
					// No image: colored text band at the bottom.
					var band = document.createElement("div");
					band.style.flexShrink = "0";
					band.style.display = "flex";
					band.style.flexDirection = "column";
					band.style.alignItems = "center";
					band.style.overflow = "hidden";
					band.style.padding = "0 2px 2px";
					band.style.backgroundColor = hexToRgba(respColor, 0.15);
					band.style.borderTop = "1px solid " + hexToRgba(respColor, 0.4);
					var rText = document.createElement("div");
					rText.textContent = placed;
					rText.style.width = "100%";
					rText.style.textAlign = "center";
					rText.style.fontSize = "8px";
					rText.style.fontWeight = "600";
					rText.style.lineHeight = "1.2";
					rText.style.whiteSpace = "nowrap";
					rText.style.overflow = "hidden";
					rText.style.textOverflow = "ellipsis";
					rText.style.color = respColor;
					band.appendChild(rText);
					cellRef.appendChild(band);
				}
			}
			return;
		}
		if (responseLabels.length > 0) {
			var bottomDiv = document.createElement("div");
			bottomDiv.style.flexShrink = "0";
			bottomDiv.style.padding = "2px";
			var select = document.createElement("select");
			select.style.width = "100%";
			select.style.border = "1px solid #e2dccf";
			select.style.borderRadius = "4px";
			select.style.backgroundColor = "#fbf8f1";
			select.style.padding = "2px 4px";
			select.style.fontSize = "9px";
			select.style.color = "#2a241c";
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
		cellRef.style.backgroundColor = isCenterCell ? "#f7ece9" : "#fbf8f1";
		cellRef.style.borderColor = isCenterCell ? "#8a2e3b" : "#e2dccf";
		cellRef.style.color = "#2a241c";
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
		select.style.border = "1px solid #e2dccf";
		select.style.borderRadius = "6px";
		select.style.backgroundColor = "#fbf8f1";
		select.style.padding = "4px 6px";
		select.style.fontSize = "10px";
		select.style.color = "#2a241c";

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
		var barrierName = blockedCells[key];
		if (barrierName) {
			// Parse "r{row}-c{col}" without a regex (regex escapes don't survive
			// this template string). key.slice(1) drops the leading "r".
			var parts = key.slice(1).split("-c");
			renderBlockedCell(
				cellRef,
				parseInt(parts[0], 10),
				parseInt(parts[1], 10),
				barrierName,
			);
			return;
		}
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
		var color = isClear ? "#a0967f" : (meta.color || "#60a5fa");
		var chip = document.createElement("button");
		chip.type = "button";
		chip.textContent = catName;
		chip.style.display = "inline-flex";
		chip.style.alignItems = "center";
		chip.style.justifyContent = "center";
		chip.style.borderRadius = "9999px";
		chip.style.border = "1px solid #e2dccf";
		chip.style.padding = "4px 10px";
		chip.style.fontSize = "11px";
		chip.style.fontWeight = "500";
		chip.style.backgroundColor = isClear ? "#fbf8f1" : hexToRgba(color, 0.12);
		chip.style.color = "#2a241c";
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

	function createResponseChip(lbl, isClear) {
		var meta = isClear ? {} : getResponseMeta(lbl);
		var color = isClear ? "#a0967f" : (meta.color || "#8b5cf6");
		var chip = document.createElement("button");
		chip.type = "button";
		chip.textContent = lbl;
		chip.style.display = "inline-flex";
		chip.style.alignItems = "center";
		chip.style.justifyContent = "center";
		chip.style.borderRadius = "9999px";
		chip.style.border = "1px solid #e2dccf";
		chip.style.padding = "4px 10px";
		chip.style.fontSize = "11px";
		chip.style.fontWeight = "500";
		chip.style.backgroundColor = isClear ? "#fbf8f1" : hexToRgba(color, 0.12);
		chip.style.color = "#2a241c";
		chip.style.cursor = "grab";
		chip.draggable = true;

		chip.ondragstart = function (event) {
			draggedResponseLabel = isClear ? "__CLEAR_RESP__" : lbl;
			if (event.dataTransfer) {
				event.dataTransfer.setData("text/plain", draggedResponseLabel);
				event.dataTransfer.effectAllowed = "move";
			}
		};

		chip.ondragend = function () {
			draggedResponseLabel = null;
		};

		return chip;
	}

	var questionText = document.createElement("p");
	questionText.textContent = cfg.layout.questionText;
	questionText.style.marginBottom = "8px";
	questionText.style.fontFamily = "'Source Serif 4', serif";
	questionText.style.fontSize = "17px";
	questionText.style.fontWeight = "600";
	questionText.style.color = "#2a241c";
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
		toolbarLabel.style.color = "#8a8170";
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
			btn.style.border = cat === activeCategory ? "1px solid " + color : "1px solid #e2dccf";
			btn.style.padding = "2px 8px";
			btn.style.fontSize = "11px";
			btn.style.backgroundColor = cat === activeCategory ? hexToRgba(color, 0.15) : "#fbf8f1";
			btn.style.color = "#2a241c";
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
					other.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#fbf8f1";
					other.style.borderColor = isActive ? otherColor : "#e2dccf";
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
		dragLabel.style.color = "#8a8170";
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

	if (isExperimental && responseLabels.length > 0 && selectionMode === "paint") {
		var respToolbar = document.createElement("div");
		respToolbar.style.display = "flex";
		respToolbar.style.flexWrap = "wrap";
		respToolbar.style.alignItems = "center";
		respToolbar.style.gap = "4px";
		respToolbar.style.marginBottom = "6px";

		var respToolbarLabel = document.createElement("span");
		respToolbarLabel.textContent = "Reacting:";
		respToolbarLabel.style.fontSize = "11px";
		respToolbarLabel.style.fontWeight = "600";
		respToolbarLabel.style.color = "#8a8170";
		respToolbar.appendChild(respToolbarLabel);

		responseLabels.forEach(function (lbl) {
			var meta = getResponseMeta(lbl);
			var color = meta.color || "#8b5cf6";
			var btn = document.createElement("button");
			btn.type = "button";
			btn.dataset.resp = lbl;
			btn.style.display = "inline-flex";
			btn.style.alignItems = "center";
			btn.style.gap = "4px";
			btn.style.borderRadius = "9999px";
			btn.style.border = lbl === activeResponseLabel ? "1px solid " + color : "1px solid #e2dccf";
			btn.style.padding = "2px 8px";
			btn.style.fontSize = "11px";
			btn.style.backgroundColor = lbl === activeResponseLabel ? hexToRgba(color, 0.15) : "#fbf8f1";
			btn.style.color = "#2a241c";
			btn.style.cursor = "pointer";

			var dot = document.createElement("span");
			dot.style.display = "inline-block";
			dot.style.width = "8px";
			dot.style.height = "8px";
			dot.style.borderRadius = "9999px";
			dot.style.backgroundColor = color;
			dot.style.flexShrink = "0";
			btn.appendChild(dot);
			btn.appendChild(document.createTextNode(lbl));

			btn.onclick = function () {
				activeResponseLabel = lbl;
				Array.prototype.forEach.call(respToolbar.querySelectorAll("button"), function (other) {
					var otherMeta = getResponseMeta(other.dataset.resp);
					var otherColor = otherMeta.color || "#8b5cf6";
					var isActive = other.dataset.resp === lbl;
					other.style.backgroundColor = isActive ? hexToRgba(otherColor, 0.15) : "#fbf8f1";
					other.style.borderColor = isActive ? otherColor : "#e2dccf";
				});
			};

			respToolbar.appendChild(btn);
		});

		container.appendChild(respToolbar);
	}

	if (isExperimental && responseLabels.length > 0 && selectionMode === "dragdrop") {
		var respDragHelp = document.createElement("div");
		respDragHelp.style.display = "flex";
		respDragHelp.style.flexDirection = "column";
		respDragHelp.style.gap = "6px";
		respDragHelp.style.marginBottom = "8px";

		var respDragLabel = document.createElement("span");
		respDragLabel.textContent = "Drag a reaction onto a cell:";
		respDragLabel.style.fontSize = "11px";
		respDragLabel.style.fontWeight = "600";
		respDragLabel.style.color = "#8a8170";
		respDragHelp.appendChild(respDragLabel);

		var respDragTray = document.createElement("div");
		respDragTray.style.display = "flex";
		respDragTray.style.flexWrap = "wrap";
		respDragTray.style.gap = "6px";

		responseLabels.forEach(function (lbl) {
			respDragTray.appendChild(createResponseChip(lbl, false));
		});
		respDragTray.appendChild(createResponseChip("Clear reaction", true));

		respDragHelp.appendChild(respDragTray);
		container.appendChild(respDragHelp);
	}

	var totalCellsCount = cfg.layout.rows * cfg.layout.cols;
	var centerRowVal = cfg.layout.centerRow || Math.ceil(cfg.layout.rows / 2);
	var centerColVal = cfg.layout.centerCol || Math.ceil(cfg.layout.cols / 2);
	computePrefills(totalCellsCount, centerRowVal, centerColVal);

	var wrapper = document.createElement("div");
	wrapper.style.width = cfg.tuning.previewWidth + "px";
	wrapper.style.height = cfg.tuning.previewHeight + "px";
	wrapper.style.border = "1px solid #e2dccf";
	wrapper.style.backgroundColor = "#f3efe6";
	wrapper.style.overflow = "auto";
	wrapper.style.borderRadius = "0.75rem";
	wrapper.style.position = "relative";

	if (cfg.layout.backgroundImageUrl) {
		wrapper.style.backgroundImage = "url('" + cfg.layout.backgroundImageUrl + "')";
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
		var isBlocked = !!blockedCells[key];
		var cell = document.createElement("div");
		cell.style.borderRadius = "0.375rem";
		cell.style.border = "1px solid #e2dccf";
		cell.style.minWidth = "0";
		cell.style.minHeight = "0";
		cell.style.fontSize = "10px";
		cell.style.fontWeight = "500";
		cell.style.transition = "border-color 120ms ease, background-color 120ms ease";

		renderCell(cell, key, isCenter);

		if (!isExperimental && allowInteraction && selectionMode === "paint" && !isBlocked) {
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

		if (!isExperimental && allowInteraction && selectionMode === "dragdrop" && !isBlocked) {
			(function (cellRef, cellKey, isCenterCell) {
				cellRef.style.cursor = isCenterCell ? "default" : "copy";
				cellRef.ondragover = function (event) {
					if (isCenterCell) return;
					event.preventDefault();
					if (event.dataTransfer) {
						event.dataTransfer.dropEffect = "move";
					}
					cellRef.style.borderColor = "#8a2e3b";
					cellRef.style.backgroundColor = "#f0e0dc";
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

		if (isExperimental && responseLabels.length > 0 && selectionMode === "paint" && !isBlocked) {
			cell.style.cursor = isCenter ? "default" : "pointer";
			(function (cellRef, cellKey, isCenterCell) {
				cellRef.onclick = function () {
					if (isCenterCell) return;
					if (!activeResponseLabel) return;
					if (experimentalResponses[cellKey] === activeResponseLabel) {
						delete experimentalResponses[cellKey];
					} else {
						experimentalResponses[cellKey] = activeResponseLabel;
					}
					persistAll();
					renderCell(cellRef, cellKey, isCenterCell);
				};
			})(cell, key, isCenter);
		}

		if (isExperimental && responseLabels.length > 0 && selectionMode === "dragdrop" && !isBlocked) {
			(function (cellRef, cellKey, isCenterCell) {
				cellRef.style.cursor = isCenterCell ? "default" : "copy";
				cellRef.ondragover = function (event) {
					if (isCenterCell) return;
					event.preventDefault();
					if (event.dataTransfer) {
						event.dataTransfer.dropEffect = "move";
					}
					cellRef.style.borderColor = "#8a2e3b";
					cellRef.style.backgroundColor = "#f0e0dc";
				};
				cellRef.ondragleave = function () {
					renderCell(cellRef, cellKey, isCenterCell);
				};
				cellRef.ondrop = function (event) {
					if (isCenterCell) return;
					event.preventDefault();
					var dropped = draggedResponseLabel;
					if (!dropped && event.dataTransfer) {
						dropped = event.dataTransfer.getData("text/plain");
					}
					if (!dropped) {
						renderCell(cellRef, cellKey, isCenterCell);
						return;
					}
					if (dropped === "__CLEAR_RESP__") {
						delete experimentalResponses[cellKey];
					} else {
						experimentalResponses[cellKey] = dropped;
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
	nextBtn.style.border = "1px solid #8a2e3b";
	nextBtn.style.backgroundColor = "#8a2e3b";
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

/* ------------------------------------------------------------------ *
 * QSF (Qualtrics Survey Format) export
 *
 * A .qsf file is a JSON document Qualtrics can import directly via
 * Projects -> Create project -> Survey -> "From a file". Importing it
 * builds the whole survey for the researcher: one Text/Graphic question
 * per grid (with the rendering JavaScript already attached), every
 * embedded-data field pre-declared in the Survey Flow, and each grid on
 * its own page. No manual question/field/JS setup required.
 * ------------------------------------------------------------------ */

export interface QualtricsQsfItem {
  /** Human-readable title used for the block description. */
  title: string;
  config: GridConfig;
  /** Standard-mode field name. Defaults to "GridAssignments". */
  embeddedDataField?: string;
  /** Experimental-mode pre-fill field. Defaults to "GridPrefills". */
  prefillsField?: string;
  /** Experimental-mode response field. Defaults to "GridResponses". */
  responsesField?: string;
}

function isExperimentalConfig(config: GridConfig): boolean {
  return !!(config.experimental && config.experimental.enabled);
}

/** Embedded-data field names a given item will write to, in display order. */
export function qsfEmbeddedFields(item: QualtricsQsfItem): string[] {
  if (isExperimentalConfig(item.config)) {
    return [
      item.prefillsField ?? "GridPrefills",
      item.responsesField ?? "GridResponses",
    ];
  }
  return [item.embeddedDataField ?? "GridAssignments"];
}

function randomQualtricsId(prefix: string): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 15; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + id;
}

function randomUuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4";
    } else if (i === 19) {
      out += hex[8 + Math.floor(Math.random() * 4)];
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}

function formatQualtricsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Build a complete .qsf document (as a JSON string) containing one
 * Text/Graphic question per item, with the grid JavaScript attached and
 * all embedded-data fields declared in the Survey Flow. Works for
 * standard, experimental, and multi-survey bundles.
 *
 * `brandId` only needs to be a non-empty string to satisfy the importer's
 * schema validation — Qualtrics reassigns the survey to the importing
 * account's brand regardless of this value.
 */
export function buildQualtricsQsf(
  items: QualtricsQsfItem[],
  surveyName = "GRIDDY Survey",
  brandId = "GRIDDY",
): string {
  const surveyId = randomQualtricsId("SV_");
  const creatorId = randomQualtricsId("UR_");
  const responseSetId = randomQualtricsId("RS_");
  const quotaGroupId = randomQualtricsId("QG_");
  const previewId = randomUuid();
  const timestamp = formatQualtricsDate(new Date());

  const questionElements: unknown[] = [];
  const blocks: Array<{ id: string; block: unknown }> = [];
  const embeddedData: unknown[] = [];
  const seenFields = new Set<string>();

  items.forEach((item, index) => {
    const qid = `QID${index + 1}`;
    const fields = qsfEmbeddedFields(item);
    const snippet = isExperimentalConfig(item.config)
      ? buildQualtricsSnippet(item.config, {
          prefillsField: fields[0],
          responsesField: fields[1],
        })
      : buildQualtricsSnippet(item.config, { embeddedDataField: fields[0] });

    const questionText =
      item.config.layout.questionText || item.title || `Grid question ${index + 1}`;

    questionElements.push({
      SurveyID: surveyId,
      Element: "SQ",
      PrimaryAttribute: qid,
      SecondaryAttribute: questionText,
      TertiaryAttribute: null,
      Payload: {
        QuestionText: questionText,
        DefaultChoices: false,
        DataExportTag: `Q${index + 1}`,
        QuestionType: "DB",
        Selector: "TB",
        DataVisibility: { Private: false, Hidden: false },
        Configuration: { QuestionDescriptionOption: "UseText" },
        QuestionDescription: questionText,
        ChoiceOrder: [],
        Validation: { Settings: { Type: "None" } },
        GradingData: [],
        Language: [],
        NextChoiceId: 1,
        NextAnswerId: 1,
        QuestionID: qid,
        QuestionJS: snippet,
      },
    });

    const blockId = randomQualtricsId("BL_");
    blocks.push({
      id: blockId,
      block: {
        Type: index === 0 ? "Default" : "Standard",
        Description: item.title || `Grid question ${index + 1}`,
        ID: blockId,
        BlockElements: [{ Type: "Question", QuestionID: qid }],
      },
    });

    fields.forEach((field) => {
      if (seenFields.has(field)) return;
      seenFields.add(field);
      embeddedData.push({
        Description: field,
        Type: "Recipient",
        Field: field,
        VariableType: "String",
        DataVisibility: [],
        AnalyzeText: false,
      });
    });
  });

  // Survey Flow: declare embedded data first, then walk each block in order.
  // Root reserves FL_1; child flow elements start at FL_2.
  let flowCounter = 1;
  const nextFlowId = () => `FL_${++flowCounter}`;
  const flow: unknown[] = [];
  if (embeddedData.length > 0) {
    flow.push({
      Type: "EmbeddedData",
      FlowID: nextFlowId(),
      EmbeddedData: embeddedData,
    });
  }
  blocks.forEach(({ id }) => {
    flow.push({ Type: "Block", ID: id, FlowID: nextFlowId(), Autofill: [] });
  });

  // BL Payload is a JSON array of block objects (matches real exports).
  const blockPayload = blocks.map(({ block }) => block);

  // Element set and ordering mirror a real Qualtrics .qsf export.
  const surveyElements: unknown[] = [
    {
      SurveyID: surveyId,
      Element: "BL",
      PrimaryAttribute: "Survey Blocks",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: blockPayload,
    },
    {
      SurveyID: surveyId,
      Element: "FL",
      PrimaryAttribute: "Survey Flow",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: {
        Type: "Root",
        FlowID: "FL_1",
        Flow: flow,
        Properties: { Count: flowCounter },
      },
    },
    {
      SurveyID: surveyId,
      Element: "PL",
      PrimaryAttribute: "Preview Link",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: { PreviewType: "Brand", PreviewID: previewId },
    },
    {
      SurveyID: surveyId,
      Element: "PROJ",
      PrimaryAttribute: "CORE",
      SecondaryAttribute: null,
      TertiaryAttribute: "1.1.0",
      Payload: { ProjectCategory: "CORE", SchemaVersion: "1.1.0" },
    },
    {
      SurveyID: surveyId,
      Element: "QC",
      PrimaryAttribute: "Survey Question Count",
      SecondaryAttribute: String(items.length),
      TertiaryAttribute: null,
      Payload: null,
    },
    {
      SurveyID: surveyId,
      Element: "QG",
      PrimaryAttribute: quotaGroupId,
      SecondaryAttribute: "Default Quota Group",
      TertiaryAttribute: null,
      Payload: {
        ID: quotaGroupId,
        Name: "Default Quota Group",
        Selected: true,
        MultipleMatch: "PlaceInAll",
        Public: false,
        Quotas: [],
      },
    },
    {
      SurveyID: surveyId,
      Element: "QGO",
      PrimaryAttribute: "QGO_QuotaGroupOrder",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: [quotaGroupId],
    },
    {
      SurveyID: surveyId,
      Element: "RS",
      PrimaryAttribute: responseSetId,
      SecondaryAttribute: "Default Response Set",
      TertiaryAttribute: null,
      Payload: null,
    },
    {
      SurveyID: surveyId,
      Element: "SCO",
      PrimaryAttribute: "Scoring",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: {
        ScoringCategories: [],
        ScoringCategoryGroups: [],
        ScoringSummaryCategory: null,
        ScoringSummaryAfterQuestions: 0,
        ScoringSummaryAfterSurvey: 0,
        DefaultScoringCategory: null,
        AutoScoringCategory: null,
      },
    },
    {
      SurveyID: surveyId,
      Element: "SO",
      PrimaryAttribute: "Survey Options",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: {
        BackButton: "false",
        SaveAndContinue: "true",
        SurveyProtection: "PublicSurvey",
        BallotBoxStuffingPrevention: "false",
        NoIndex: "Yes",
        SecureResponseFiles: "true",
        SurveyExpiration: "None",
        SurveyTermination: "DefaultMessage",
        Header: "",
        Footer: "",
        ProgressBarDisplay: "None",
        PartialData: "+1 week",
        ValidationMessage: "",
        PreviousButton: "",
        NextButton: "",
        SurveyTitle: surveyName,
        NewScoring: 1,
      },
    },
    ...questionElements,
    {
      SurveyID: surveyId,
      Element: "STAT",
      PrimaryAttribute: "Survey Statistics",
      SecondaryAttribute: null,
      TertiaryAttribute: null,
      Payload: { MobileCompatible: true, ID: "Survey Statistics" },
    },
  ];

  const qsf = {
    SurveyEntry: {
      SurveyID: surveyId,
      SurveyName: surveyName,
      SurveyDescription: null,
      SurveyOwnerID: creatorId,
      SurveyBrandID: brandId || "GRIDDY",
      DivisionID: null,
      SurveyLanguage: "EN",
      SurveyActiveResponseSet: responseSetId,
      SurveyStatus: "Inactive",
      SurveyStartDate: "0000-00-00 00:00:00",
      SurveyExpirationDate: "0000-00-00 00:00:00",
      SurveyCreationDate: timestamp,
      CreatorID: creatorId,
      LastModified: timestamp,
      LastAccessed: "0000-00-00 00:00:00",
      LastActivated: "0000-00-00 00:00:00",
      Deleted: null,
    },
    SurveyElements: surveyElements,
  };

  return JSON.stringify(qsf, null, 2);
}

/** Convenience wrapper to build a .qsf for a single grid configuration. */
export function buildQualtricsQsfForConfig(
  config: GridConfig,
  surveyName?: string,
): string {
  const name = surveyName || config.name || "GRIDDY Survey";
  return buildQualtricsQsf(
    [{ title: config.name || name, config }],
    name,
  );
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
			wrapper.style.backgroundImage = "url('" + cfg.layout.backgroundImageUrl + "')";
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
