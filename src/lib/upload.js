import { db } from "@/api/client";

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a store logo or product photo and returns its public URL. */
export async function uploadImage(file) {
  if (!file) return "";
  if (!file.type?.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG or WebP)");
  if (file.size > MAX_BYTES) throw new Error("That image is over 5 MB — pick a smaller one");
  const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
  return file_url;
}