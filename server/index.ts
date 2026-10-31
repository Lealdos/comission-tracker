import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/bun";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { authProxy } from "./auth.ts";
import { acquisitionRoutes, dealRoutes, spiffRoutes } from "./routes/entries.ts";
import { meRoutes } from "./routes/me.ts";
import { monthRoutes } from "./routes/months.ts";

const app = new Hono();

// nosniff, frame and referrer policies, HSTS, etc. on everything this server sends (the API, and the built app in production).
app.use("*", secureHeaders());
app.use("/api/*", logger());
// Neon Auth's cookies are SameSite=None, so they ride along on cross-site requests. JSON calls already need a CORS
// preflight this API never grants; this also turns away form-style posts (text/plain, urlencoded) from other origins.
app.use("/api/*", csrf());
// Bodies here are small JSON (the longest field is a 2,000-character note).
app.use("/api/*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "Request body too large" }, 413) }));
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
  // Middleware and validators reject bad requests with HTTPException (403 from csrf, 400 for malformed JSON): keep their status.
  if (err instanceof HTTPException) return c.json({ error: err.message || "Request rejected" }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong on the server" }, 500);
});

const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: app.fetch });
console.log(`API listening on ${server.url}`);
