import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { geminiVitePlugin } from "./server/geminiService";
import { syncVitePlugin } from "./server/syncService";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), geminiVitePlugin(), syncVitePlugin()],
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
      alias: {
        "react": path.resolve(import.meta.dirname, "node_modules/react"),
        "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      hmr: false,
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
        "/api/weather": {
          target: "https://api.open-meteo.com/v1/forecast",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/weather/, ""),
        },
      },
    },
  };
});
