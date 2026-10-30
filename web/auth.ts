// Neon Auth (Managed Better Auth), reached through the server's same-origin proxy at /api/auth
// (server/auth.ts), so the session cookies are first-party and the API sees them too.

import { createAuthClient } from "@neon/auth";
import { ApiError } from "./api.ts";

const authClient = createAuthClient(`${window.location.origin}/api/auth`);

/** Better Auth answers `{ data, error }`; turn an error into the ApiError the rest of the UI handles. */
async function unwrap<T>(call: Promise<{ data: T; error: null } | { data: null; error: { message?: string; status: number } }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new ApiError(error.message || `Request failed (${error.status})`, error.status);
  return data;
}

export const signIn = (body: { email: string; password: string }) => unwrap(authClient.signIn.email(body));
export const signUp = (body: { name: string; email: string; password: string }) => unwrap(authClient.signUp.email(body));
export const signOut = () => unwrap(authClient.signOut());
