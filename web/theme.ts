// Light/dark preference. "system" follows the OS setting; an explicit choice is saved in localStorage.
// The resolved theme lives on <html data-theme>, which index.html also sets before first paint.

import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function saved(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Storage blocked (private window, site data off): follow the OS.
  }
  return "system";
}

let preference = saved();

const resolved = (): Theme => (preference === "system" ? (systemDark.matches ? "dark" : "light") : preference);

function apply() {
  document.documentElement.dataset.theme = resolved();
  for (const listener of listeners) listener();
}

systemDark.addEventListener("change", apply);
// Another tab changed the setting.
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  preference = saved();
  apply();
});
apply();

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not saved, but still applied for this visit.
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return {
    preference: useSyncExternalStore(subscribe, () => preference),
    theme: useSyncExternalStore(subscribe, resolved),
  };
}
