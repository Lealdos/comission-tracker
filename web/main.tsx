import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ApiError } from "./api.ts";
import { App } from "./App.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
// Fonts ship with the app (same origin, font-display: swap) instead of a render-blocking Google Fonts stylesheet.
import "@fontsource-variable/figtree";
import "@fontsource/barlow-semi-condensed/latin-500.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "./index.css";

// A 401 from any request means the session ended (expired or signed out elsewhere): drop back to sign-in.
function onError(error: Error) {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(["me"], null);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: { queries: { retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
