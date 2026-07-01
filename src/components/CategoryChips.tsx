import React, { useState } from "react";
import { LayerMode } from "../grid-types";

const SWATCH_PALETTE = [
  "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#3b82f6", "#ec4899", "#84cc16", "#06b6d4",
  "#f87171", "#60a5fa", "#4ade80", "#fb923c",
];

export interface ChipItem {
  name: string;
  color: string;
  imageUrl?: string;
  layerMode?: LayerMode;
}

interface Props {
  items: ChipItem[];
  onChange: (items: ChipItem[]) => void;
  addLabel?: string;
  editorTitle?: string;
  showLayerMode?: boolean;
  showClearAll?: boolean;
}

export const CategoryChips: React.FC<Props> = ({
  items,
  onChange,
  addLabel = "+ Add",
  editorTitle = "EDITING",
  showLayerMode = false,
  showClearAll = false,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open = openIndex != null ? items[openIndex] : null;

  const update = (idx: number, patch: Partial<ChipItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    setOpenIndex(null);
  };

  const clearAll = () => {
    onChange([]);
    setOpenIndex(null);
  };

  const addNew = () => {
    const used = new Set(items.map((it) => it.color));
    const color =
      SWATCH_PALETTE.find((c) => !used.has(c)) ??
      SWATCH_PALETTE[items.length % SWATCH_PALETTE.length];
    const next = [...items, { name: "New label", color, imageUrl: "" }];
    onChange(next);
    setOpenIndex(next.length - 1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold text-ink transition-shadow ${
              openIndex === i
                ? "border-accent bg-accent-soft shadow-sm"
                : "border-hairline bg-white hover:border-accent/40 hover:shadow"
            }`}
          >
            <span
              className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-base leading-none text-ink-faint hover:bg-accent-tint hover:text-accent"
            >
              ×
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={addNew}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-hairline px-4 py-1.5 text-sm font-semibold text-ink-faint transition-colors hover:border-accent hover:text-accent"
        >
          {addLabel}
        </button>
        {showClearAll && items.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-accent"
          >
            Clear all
          </button>
        )}
      </div>

      {open != null && openIndex != null && (
        <div className="mt-3.5 rounded-xl border border-hairline bg-paper-window p-4">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-ink-faint">
              {editorTitle}
            </span>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="text-xs font-bold text-ink-muted hover:text-ink"
            >
              Done
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-widest text-ink-faint">
                NAME
              </span>
              <input
                type="text"
                value={open.name}
                onChange={(e) => update(openIndex, { name: e.target.value })}
                className="rounded-lg border border-hairline bg-white px-3 py-2.5 font-serif text-[15px] text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-widest text-ink-faint">
                IMAGE URL{" "}
                <span className="font-medium text-[#c2b59c]">optional</span>
              </span>
              <input
                type="url"
                value={open.imageUrl ?? ""}
                onChange={(e) => update(openIndex, { imageUrl: e.target.value })}
                placeholder="https://example.com/icon.png"
                className="rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-[10px] font-bold tracking-widest text-ink-faint">
              COLOR
            </span>
            <div className="flex flex-wrap gap-2.5">
              {SWATCH_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => update(openIndex, { color: hex })}
                  className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: hex,
                    outline:
                      hex === open.color
                        ? "2.5px solid #2a241c"
                        : "1px solid #e2dccf",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          {showLayerMode && (open.imageUrl ?? "").length > 0 && (
            <div className="mt-4">
              <span className="mb-2 block text-[10px] font-bold tracking-widest text-ink-faint">
                LAYER MODE
              </span>
              <div className="flex gap-4">
                {(["replace", "front", "behind"] as LayerMode[]).map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-1.5 text-sm text-ink"
                  >
                    <input
                      type="radio"
                      name={`layerMode-${openIndex}`}
                      checked={(open.layerMode ?? "replace") === m}
                      onChange={() => update(openIndex, { layerMode: m })}
                      className="h-3.5 w-3.5"
                    />
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={() => remove(openIndex)}
              className="text-sm font-bold text-accent hover:underline"
            >
              Remove label
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryChips;
