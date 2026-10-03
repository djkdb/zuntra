/**
 * Downscales a photo in the browser before upload (max 2048px, WebP). Saves mobile data and
 * storage; also strips EXIF metadata such as GPS. Falls back to the original file if the
 * browser cannot decode it.
 */
export async function resizeImage(file: File, maxSize = 2048, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("encode failed");
    return { blob, width, height };
  } catch {
    return { blob: file, width: 0, height: 0 };
  }
}
