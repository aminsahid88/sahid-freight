/**
 * Blur check before upload. Without native image processing we cannot run a
 * Laplacian, so this is a documented heuristic: a JPEG of a sharp receipt
 * (fine black text on paper) compresses far less per pixel than a blurred one.
 * At the capture quality we use (0.7) sharp receipts land well above 0.10
 * bytes per pixel; motion-blurred or out-of-focus shots fall below ~0.06.
 * The threshold errs on the side of asking for a retake. The server will add
 * a real quality score later (V007); this check only prevents obvious misses.
 */

export interface SharpnessInput {
  bytes: number;
  width: number;
  height: number;
}

export type SharpnessVerdict = "ok" | "borderline" | "blurry" | "unknown";

export const BLURRY_BELOW = 0.06;
export const BORDERLINE_BELOW = 0.09;
/** Below this many pixels the shot is too small to read regardless of focus. */
export const MIN_PIXELS = 600 * 800;

export function bytesPerPixel({ bytes, width, height }: SharpnessInput): number | null {
  if (!Number.isFinite(bytes) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || bytes <= 0) return null;
  return bytes / (width * height);
}

export function sharpnessVerdict(input: SharpnessInput): { verdict: SharpnessVerdict; bytesPerPixel: number | null; tooSmall: boolean } {
  const bpp = bytesPerPixel(input);
  const tooSmall = input.width * input.height < MIN_PIXELS;
  if (bpp === null) return { verdict: "unknown", bytesPerPixel: null, tooSmall };
  if (bpp < BLURRY_BELOW) return { verdict: "blurry", bytesPerPixel: bpp, tooSmall };
  if (bpp < BORDERLINE_BELOW) return { verdict: "borderline", bytesPerPixel: bpp, tooSmall };
  return { verdict: "ok", bytesPerPixel: bpp, tooSmall };
}
