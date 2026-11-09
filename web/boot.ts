// index.html starts GET /api/me (with ?month= on the dashboard) before the app's JavaScript has even downloaded,
// so the account and the month arrive alongside the code instead of after it.

declare global {
  interface Window {
    /** Set by the inline script in index.html; `month` is null off the dashboard. */
    __boot?: { month: string | null; me: Promise<Response> };
  }
}

/** The response index.html asked for, handed out once: later calls (a refetch after signing in) make their own request. */
export function takeBootResponse(): Promise<Response> | undefined {
  const boot = window.__boot;
  if (!boot) return undefined;
  window.__boot = undefined;
  return boot.me;
}
