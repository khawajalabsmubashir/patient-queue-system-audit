import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, loadEnv } from "vite";
const backendPort = process.env["BACKEND_PORT"] || "3001";
export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: false,
    hmr: process.env.DISABLE_HMR !== "true",
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        "**/data/**",
        "**/work/**",
        "**/.npm-cache/**",
        "**/*.db",
        "**/*.db-*",
        "**/*.sqlite*",
      ],
    },
    watch:
      process.env.DISABLE_HMR === "true"
        ? null
        : { ignored: ["**/data/**", "**/.npm-cache/**", "**/work/**"] },
    proxy: {
      "/api": `http://127.0.0.1:${backendPort}`,
      "/socket.io": { target: `http://127.0.0.1:${backendPort}`, ws: true },
    },
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      server: { entry: "server" },
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    react(),
  ],
});
