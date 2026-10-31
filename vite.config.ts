import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./web", import.meta.url)) } },
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        // Libraries get their own chunks, so they keep their hashes (and the browser's cached copy) across deploys
        // that only change app code, and no file passes Vite's 500 kB warning. entriesAware keeps code that only a
        // lazy import uses (the Neon Auth client, see web/auth.ts) out of the chunks every page loads.
        codeSplitting: {
          groups: [
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 2 },
            { name: "vendor", test: /[\\/]node_modules[\\/]/, priority: 1, entriesAware: true },
          ],
        },
      },
    },
  },
});
