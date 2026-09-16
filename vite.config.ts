import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * File sink for the browser HTTP logger (src/api/httpLogger.ts): the app POSTs
 * one JSON entry per request to /__http-log, appended here as NDJSON to
 * logs/http-<date>.log. Dev server only — a production build has no sink.
 */
function httpLogSink(): Plugin {
  return {
    name: "de9de9:http-log-sink",
    configureServer(server) {
      const dir = path.resolve(__dirname, "logs");
      const file = path.join(
        dir,
        `http-${new Date().toISOString().slice(0, 10)}.log`,
      );
      server.middlewares.use("/__http-log", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(file, body + "\n");
            res.statusCode = 204;
          } catch {
            res.statusCode = 500;
          }
          res.end();
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  // This file runs in Node, not the browser: `import.meta.env` does NOT exist
  // here and reading it throws. loadEnv is the supported way to read .env from
  // a config file — it parses .env / .env.<mode> itself. The empty prefix makes
  // it return every key, so VITE_-prefixed names work too.
  const env = loadEnv(mode, process.cwd(), "");
  const authOrigin = env.VITE_AUTH_ORIGIN;

  // No hardcoded fallback: the origin lives in .env and nowhere else. Missing it
  // must fail loudly rather than silently proxy somewhere unintended — but only
  // for `vite dev`, since a production build never proxies.
  if (command === "serve" && !authOrigin) {
    throw new Error(
      "VITE_AUTH_ORIGIN is not set. Copy .env.example to .env and set it — the " +
        "dev server proxies /api and /auth-api to that origin.",
    );
  }

  return {
    plugins: [react(), tailwindcss(), httpLogSink()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: authOrigin
      ? {
          proxy: {
            // The auth API answers preflight with 204 but sends no
            // Access-Control-Allow-Origin, so a browser blocks direct calls from
            // localhost. Proxying server-to-server sidesteps CORS in dev; deploy
            // behind the same reverse proxy, or have the API allow this origin.
            "/auth-api": {
              target: authOrigin,
              changeOrigin: true,
              secure: true,
              rewrite: (p: string) => p.replace(/^\/auth-api/, "/api/v1"),
            },
            // Business API (apiClient), same origin/CORS story as above. Only
            // hit when VITE_API_MOCK=false — with the mock on, the axios adapter
            // answers before any network request is made.
            "/api": {
              target: authOrigin,
              changeOrigin: true,
              secure: true,
              rewrite: (p: string) => p.replace(/^\/api(?=\/|$)/, "/api/v1"),
            },
          },
        }
      : {},
  };
});
