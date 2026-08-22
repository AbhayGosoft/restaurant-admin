import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:4000";
  const apiProxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
    },
    "/uploads": {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
    },
  };

  return {
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 3000,
      host: true,
      allowedHosts: ["connector.bharatotel.com"],
      proxy: apiProxy,
    },
    preview: {
      port: 3000,
      host: true,
      allowedHosts: ["connector.bharatotel.com"],
      proxy: apiProxy,
    },
    build: {
      target: "es2022",
      sourcemap: true,
      chunkSizeWarningLimit: 750,
    },
  };
});
