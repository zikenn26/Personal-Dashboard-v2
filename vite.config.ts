import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { geminiVitePlugin } from "./server/geminiService";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  // No hardcoded fallback project credentials: cloud sync stays disabled (local-first mode)
  // until the developer/deployment explicitly provides its own Supabase project via .env.
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  return {
    plugins: [react(), tailwindcss(), geminiVitePlugin()],
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
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
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
          target: supabaseUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/supabase/, ""),
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
