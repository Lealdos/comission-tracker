import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { authProxy } from "./auth.ts";
import { acquisitionRoutes, dealRoutes, spiffRoutes } from "./routes/entries.ts";
import { meRoutes } from "./routes/me.ts";
import { monthRoutes } from "./routes/months.ts";

const app = new Hono();

app.use("/api/*", logger());
// Neon Auth (sign-up, sign-in, sign-out, sessions), proxied so its cookies stay on this origin.
app.all("/api/auth/*", authProxy);
app.route("/api/me", meRoutes);
app.route("/api/deals", dealRoutes);
app.route("/api/acquisitions", acquisitionRoutes);
app.route("/api/spiffs", spiffRoutes);
app.route("/api/months", monthRoutes);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// In development Vite serves the web app and proxies /api here; in production we serve the build.
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong on the server" }, 500);
});

const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: app.fetch });
console.log(`API listening on ${server.url}`);
