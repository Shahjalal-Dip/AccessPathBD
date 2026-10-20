import { open } from "fs/promises";

export type DetectedImage = { mime: string; ext: string };

/**
 * Detect the real image type from file content ("magic bytes").
 * The Content-Type header sent by a client is trivial to fake, so we never
 * trust it on its own.
 */
export function detectImageType(head: Buffer): DetectedImage | null {
  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  )
    return { mime: "image/jpeg", ext: ".jpg" };
  if (
    head.length >= 8 &&
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: "image/png", ext: ".png" };
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString("ascii") === "RIFF" &&
    head.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { mime: "image/webp", ext: ".webp" };
  return null;
}

export async function detectImageTypeFromFile(
  path: string,
): Promise<DetectedImage | null> {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    return detectImageType(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
