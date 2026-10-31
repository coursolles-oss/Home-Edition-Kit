import { MAX_IMAGE_BYTES, type ImageUpload } from "@home-kit/shared";
import { HttpError } from "../errors";

const startsWith = (bytes: Buffer, sig: number[], offset = 0) =>
  sig.every((b, i) => bytes[offset + i] === b);

/** True when the decoded bytes carry the signature of the declared image type. */
function matchesMediaType(bytes: Buffer, mediaType: ImageUpload["media_type"]): boolean {
  switch (mediaType) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      // "RIFF" .... "WEBP"
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  }
}

/**
 * Cheap checks before spending an API call: it decodes, fits the API's 5 MB limit, and really
 * is the type it claims to be (the API rejects mismatches with an opaque 400).
 */
export function assertValidImage(image: ImageUpload): void {
  const bytes = Buffer.from(image.data_base64, "base64");
  if (bytes.length === 0) {
    throw new HttpError(400, "invalid_image", "The image is empty or not valid base64.");
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, "image_too_large", "The image is larger than 5 MB. Try a smaller photo.");
  }
  if (!matchesMediaType(bytes, image.media_type)) {
    throw new HttpError(400, "invalid_image", `The file is not a valid ${image.media_type} image.`);
  }
}
