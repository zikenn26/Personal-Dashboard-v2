import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "react": path.resolve(import.meta.dirname, "node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  define: {
    "import.meta.env.VITE_GROQ_API_KEY": JSON.stringify(
      process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || ""
    ),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api/groq": {
        target: "https://api.groq.com/openai/v1",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/groq/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const clientAuth = proxyReq.getHeader("authorization");
            if (!clientAuth || clientAuth === "Bearer " || clientAuth === "Bearer") {
              const defaultKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
              if (defaultKey) {
                proxyReq.setHeader("authorization", `Bearer ${defaultKey}`);
              }
            }
          });
        },
      },
      "/api/supabase": {
        target: process.env.VITE_SUPABASE_URL || "https://amlegmbvqzbhqqqbrvjx.supabase.co",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ""),
      },
    },
  },
});
