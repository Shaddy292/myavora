import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Every runtime dependency is bundled at startup, for the browser and the SSR server: one first imported
// mid-session makes Vite re-bundle, and a page rendered meanwhile on the server loads a second React.
const NOT_PREBUNDLED = new Set(["react", "react-dom", "@tanstack/react-start", "@tanstack/react-router", "@tanstack/react-router-ssr-query", "tailwindcss-animate"]);
const { dependencies } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const PREBUNDLE = Object.keys(dependencies).filter((name) => !NOT_PREBUNDLED.has(name));

// AVORA_TARGET=php (or --mode php) builds the client-only SPA that talks to
// the PHP backend in server-php/. Server-function modules are swapped for the
// generated RPC stubs in src/rpc/ so no server-only code reaches the browser.
export default defineConfig(({ mode }) => {
  const phpTarget = mode === "php" || process.env.AVORA_TARGET === "php";
  const rpcDir = fileURLToPath(new URL("./src/rpc", import.meta.url));
  const rpcAliases = phpTarget
    ? readdirSync(rpcDir)
        .filter((file) => file.endsWith("-fns.js"))
        .map((file) => ({
          find: new RegExp(`^@/lib/${file.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
          replacement: fileURLToPath(new URL(`./src/rpc/${file}`, import.meta.url)),
        }))
    : [];
  // Optional: point the dev server's /api calls at a remote PHP host.
  const phpOrigin = process.env.AVORA_PHP_ORIGIN;

  return {
    resolve: {
      alias: [
        ...rpcAliases,
        { find: new RegExp("^@/"), replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
      ],
    },
    optimizeDeps: { include: PREBUNDLE },
    environments: { ssr: { optimizeDeps: { include: PREBUNDLE } } },
    server: phpOrigin ? { proxy: { "/api": { target: phpOrigin, changeOrigin: true } } } : undefined,
    plugins: [
      tanstackStart({
        srcDirectory: "src",
        // The PHP backend serves the app as static files; there is no Node
        // runtime to prerender with, so the build emits a client-boot shell.
        spa: phpTarget ? { enabled: true, prerender: { enabled: false } } : undefined,
      }),
      react(),
    ],
  };
});
