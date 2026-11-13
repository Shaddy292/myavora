import { createFileRoute } from "@tanstack/react-router";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { sessionUserFromRequest } from "@/server/auth.server";
import { UPLOAD_DIR } from "@/server/store.server.js";
import { failure, jsonWithCookies } from "@/server/http.server.js";

const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSION = /\.([a-z0-9]{1,8})$/i;
const ALLOWED = new Set(["png", "jpg", "jpeg", "webp", "gif", "pdf"]);

const safeExtension = (name, type) => {
  const match = String(name || "").match(EXTENSION);
  const ext = match ? match[1].toLowerCase() : "";
  if (ALLOWED.has(ext)) return `.${ext}`;
  const byType = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "application/pdf": ".pdf" };
  const fallback = byType[type];
  if (fallback) return fallback;
  throw Object.assign(new Error("Only images and PDF documents can be uploaded"), { status: 400 });
};

export const Route = createFileRoute("/api/uploads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return jsonWithCookies({ error: "Unauthorized" }, [], { status: 401 });
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!file || typeof file === "string") {
            return jsonWithCookies({ error: "Choose a file to upload" }, [], { status: 400 });
          }
          if (file.size > MAX_BYTES) {
            return jsonWithCookies({ error: "That file is over 8 MB — pick a smaller one" }, [], { status: 413 });
          }
          mkdirSync(UPLOAD_DIR, { recursive: true });
          const name = `${randomUUID()}${safeExtension(file.name, file.type)}`;
          await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
          const url = `/api/files/${name}`;
          return jsonWithCookies({ file_url: url, file_uri: url, name, size: file.size, type: file.type || "" });
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
