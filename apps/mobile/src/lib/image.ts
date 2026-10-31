import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImageUpload } from "@home-kit/shared";

/** Longest edge sent to the model. Larger photos only cost more and upload slower. */
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.8;

export type PreparedPhoto = {
  upload: ImageUpload;
  /** Local URI of the resized photo, for previews. */
  previewUri: string;
};

/**
 * Shrinks a camera/library photo and re-encodes it as JPEG before upload. Re-encoding writes new
 * pixels to a new file, which should leave the original's embedded metadata (such as GPS
 * location) behind. Confirm that on a real device before promising it to users.
 */
export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error("Could not read the photo.");

  return {
    upload: { media_type: "image/jpeg", data_base64: saved.base64 },
    previewUri: saved.uri,
  };
}
