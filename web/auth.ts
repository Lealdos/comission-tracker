// Neon Auth (Managed Better Auth), reached through the server's same-origin proxy at /api/auth
// (server/auth.ts), so the session cookies are first-party and the API sees them too.
//
// Its client is about a fifth of the app's JavaScript, and only signing in, signing up and signing out use it
// (the session itself comes from /api/me), so it's imported on first use instead of shipping with the app.
// The sign-in and sign-up screens preload it, so their buttons don't wait for the download.

import { ApiError } from "./api.ts";
import type { authClient as AuthClient } from "./auth-client.ts";

let client: Promise<typeof AuthClient> | undefined;

function authClient() {
  client ??= import("./auth-client.ts").then((m) => m.authClient);
  // A failed download (offline, a deploy replaced the chunk) shouldn't stick: the next call tries again.
  client.catch(() => (client = undefined));
  return client;
}

/** Starts loading the auth client ahead of the first sign-in or sign-up. */
export function preloadAuth() {
  void authClient().catch(() => {});
}

/** Better Auth answers `{ data, error }`; turn an error into the ApiError the rest of the UI handles. */
async function unwrap<T>(call: Promise<{ data: T; error: null } | { data: null; error: { message?: string; status: number } }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new ApiError(error.message || `Request failed (${error.status})`, error.status);
  return data;
}

export const signIn = async (body: { email: string; password: string }) => unwrap((await authClient()).signIn.email(body));
export const signUp = async (body: { name: string; email: string; password: string }) => unwrap((await authClient()).signUp.email(body));
export const signOut = async () => unwrap((await authClient()).signOut());
