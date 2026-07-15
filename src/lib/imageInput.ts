// Client-side image → compressed base64 data URI.
//
// Images picked by the user are downscaled and re-encoded entirely in the
// browser, then stored as a `data:` URI directly in the survey config. Because
// the bytes travel inside the survey (and the exported Qualtrics QSF), there is
// no external host or storage to depend on — the survey renders images on its
// own. Downscaling/compression keeps each embedded string small so many images
// don't bloat the QSF or exceed the ~5MB localStorage cap for anonymous saves.

export interface FileToDataUriOptions {
  /** Longest side of the output image, in pixels. Defaults to 512. */
  maxDim?: number;
  /** Lossy quality for JPEG/WebP output, 0–1. Defaults to 0.8. */
  quality?: number;
  /** Reject source files larger than this many bytes. Defaults to 15MB. */
  maxSourceBytes?: number;
}

const DEFAULTS: Required<FileToDataUriOptions> = {
  maxDim: 512,
  quality: 0.8,
  maxSourceBytes: 15 * 1024 * 1024,
};

let webpSupported: boolean | null = null;

/** Whether this browser's canvas can encode WebP. Cached after first check. */
function canEncodeWebp(): boolean {
  if (webpSupported != null) return webpSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = src;
  });
}

/**
 * Read an image file, downscale it so its longest side is at most `maxDim`, and
 * return a compressed base64 data URI. PNG/GIF sources keep an alpha-capable
 * format (WebP when available, else PNG) so transparency is preserved; other
 * sources are encoded as WebP/JPEG for size.
 */
export async function fileToDataUri(
  file: File,
  options?: FileToDataUriOptions,
): Promise<string> {
  const { maxDim, quality, maxSourceBytes } = { ...DEFAULTS, ...options };

  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  if (file.size > maxSourceBytes) {
    const mb = Math.round(maxSourceBytes / (1024 * 1024));
    throw new Error(`That image is too large (max ${mb}MB before compression).`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    const { width, height } = img;
    if (!width || !height) {
      throw new Error("That image appears to be empty.");
    }

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process that image.");
    ctx.drawImage(img, 0, 0, outW, outH);

    const needsAlpha = file.type === "image/png" || file.type === "image/gif";
    let mime: string;
    if (canEncodeWebp()) {
      mime = "image/webp";
    } else {
      mime = needsAlpha ? "image/png" : "image/jpeg";
    }

    // PNG ignores the quality argument; that's fine.
    return canvas.toDataURL(mime, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Approximate decoded byte size of a base64 data URI (0 for plain URLs/empty). */
export function dataUriByteSize(value: string): number {
  if (!value.startsWith("data:")) return 0;
  const commaIdx = value.indexOf(",");
  if (commaIdx === -1) return 0;
  const data = value.slice(commaIdx + 1);
  // Base64 encodes 3 bytes per 4 chars; subtract padding.
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/** Human-readable size, e.g. "12 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
