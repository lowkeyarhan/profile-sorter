import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    // In Docker this points at the server container; locally it is localhost.
    proxy: { "/api": process.env.VITE_PROXY_TARGET ?? "http://localhost:4000" },
  },
});
