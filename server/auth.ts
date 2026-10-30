// Login is Neon Auth (Managed Better Auth). The browser talks to it only through /api/auth/*, which
// this server proxies, so its session cookies are first-party. The proxy also mints a signed
// session_data cookie, which lets most session checks skip the round trip to Neon (5-minute TTL).

import { handleAuthProxyRequest, NEON_AUTH_SESSION_COOKIE_NAME, parseSessionData } from "@neon/auth/server";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { prisma } from "./db/client.ts";
import { publicUserSelect, serializeUser, type PublicUser } from "./serialize.ts";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL is not set (run `neon deploy` or `neon env pull`)");
if (!cookieSecret) throw new Error("NEON_AUTH_COOKIE_SECRET is not set (generate one with `openssl rand -base64 32`)");

/** The Neon Auth identity behind the request. */
export type Account = { id: string; email: string; name: string };

export type SessionEnv = { Variables: { account: Account } };
export type AppEnv = { Variables: { account: Account; user: PublicUser } };

function proxy(request: Request, path: string): Promise<Response> {
  return handleAuthProxyRequest({ request, path, baseUrl: baseUrl!, cookieSecret: cookieSecret! });
}

/** Forwards a Better Auth call (`/api/auth/sign-in/email`, `/api/auth/get-session`, …) to Neon Auth. */
export function authProxy(c: Context): Promise<Response> {
  return proxy(c.req.raw, c.req.path.replace(/^\/api\/auth\//, ""));
}

async function currentAccount(c: Context): Promise<Account | null> {
  if (!c.req.header("cookie")?.includes(NEON_AUTH_SESSION_COOKIE_NAME)) return null;

  // Same path the browser's getSession() takes, so it reads and refreshes the session_data cache.
  const res = await proxy(new Request(new URL("/api/auth/get-session", c.req.url), { headers: c.req.raw.headers }), "get-session");
  if (!res.ok) throw new Error(`Neon Auth session check failed (${res.status})`);
  for (const cookie of res.headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });

  const { user } = parseSessionData(await res.json());
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}

/** Rejects with 401 unless the request carries a live Neon Auth session; exposes it as `c.get("account")`. */
export const requireSession = createMiddleware<SessionEnv>(async (c, next) => {
  const account = await currentAccount(c);
  if (!account) return c.json({ error: "Not signed in" }, 401);
  c.set("account", account);
  await next();
});

/** Like `requireSession`, and also needs the app profile; exposes it as `c.get("user")`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const account = await currentAccount(c);
  if (!account) return c.json({ error: "Not signed in" }, 401);
  const profile = await prisma.user.findUnique({ where: { authUserId: account.id }, select: publicUserSelect });
  if (!profile) return c.json({ error: "Finish setting up your profile first" }, 403);
  c.set("account", account);
  c.set("user", serializeUser(profile, account.email));
  await next();
});
