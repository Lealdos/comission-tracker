// Runs the API with Bun.serve: `bun run dev` (Vite serves the web app and proxies /api here) and `bun run start`
// on a long-running host, where this process also serves the built web app. Vercel uses api/server.ts instead.

import { serveStatic } from "hono/bun";
import { app } from "./app.ts";

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: app.fetch });
console.log(`API listening on ${server.url}`);
