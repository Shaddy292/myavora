import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/server/store.server.js";

const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

export const Route = createFileRoute("/api/files/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = String(params.name || "");
        if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        try {
          const bytes = await readFile(path.join(UPLOAD_DIR, name));
          return new Response(bytes, {
            headers: {
              "content-type": TYPES[path.extname(name).toLowerCase()] || "application/octet-stream",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
      },
    },
  },
});
