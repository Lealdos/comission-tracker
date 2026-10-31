// The Neon Auth client. Only web/auth.ts imports it, dynamically, so it stays out of the app's first download.

import { createAuthClient } from "@neon/auth";

export const authClient = createAuthClient(`${window.location.origin}/api/auth`);
