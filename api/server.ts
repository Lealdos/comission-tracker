// Vercel Function on the Bun runtime ("bunVersion" in vercel.json): one Bun.serve() answers every /api request.
// vercel.json rewrites /api/* here; the web app itself is static output served by Vercel's CDN.

import { app } from "../server/app.ts";

const FUNCTION_PATH = "/api/server";

Bun.serve({
  fetch(request) {
    // Rewrites keep the original URL (/api/deals), but a request can also arrive on the function's own path
    // (/api/server/deals); the app's routes live under /api either way.
    const url = new URL(request.url);
    if (url.pathname !== FUNCTION_PATH && !url.pathname.startsWith(`${FUNCTION_PATH}/`)) return app.fetch(request);
    url.pathname = `/api${url.pathname.slice(FUNCTION_PATH.length)}`;
    return app.fetch(new Request(url, request));
  },
});
