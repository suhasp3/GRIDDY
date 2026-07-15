import React, { useRef, useState } from "react";
import {
  fileToDataUri,
  dataUriByteSize,
  formatBytes,
} from "../lib/imageInput";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder for the URL field. */
  placeholder?: string;
  /** Warn when a single embedded image exceeds this many bytes. Default 500KB. */
  warnBytes?: number;
}

const DEFAULT_WARN_BYTES = 500 * 1024;

/**
 * Image field that accepts either an uploaded file (compressed to an embedded
 * base64 data URI, no external host) or a pasted URL. The chosen value is a
 * plain string stored in the existing imageUrl/backgroundImageUrl fields.
 */
export const ImageInput: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "https://example.com/icon.png",
  warnBytes = DEFAULT_WARN_BYTES,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDataUri = value.startsWith("data:");
  const embeddedBytes = isDataUri ? dataUriByteSize(value) : 0;
  const tooLarge = embeddedBytes > warnBytes;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUri = await fileToDataUri(file);
      onChange(dataUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that image.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {value ? (
          <img
            src={value}
            alt="preview"
            className="h-12 w-12 flex-shrink-0 rounded-lg border border-hairline object-contain bg-white"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-hairline text-[10px] text-ink-faint">
            none
          </div>
        )}

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy ? "Processing…" : value ? "Replace image" : "Upload image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChange("");
                }}
                className="text-xs font-semibold text-ink-faint hover:text-accent"
              >
                Clear
              </button>
            )}
          </div>

          <input
            type="url"
            value={isDataUri ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isDataUri ? "Uploaded image embedded" : placeholder}
            disabled={isDataUri}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none disabled:bg-paper-window disabled:text-ink-faint"
          />
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-accent">{error}</p>}

      {isDataUri && (
        <p className={`text-xs ${tooLarge ? "font-semibold text-accent" : "text-ink-faint"}`}>
          Embedded image · {formatBytes(embeddedBytes)}
          {tooLarge && " · large; consider a smaller image if you have many"}
        </p>
      )}
    </div>
  );
};

export default ImageInput;
