import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), vueDevTools()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Add these settings for Vercel deployment
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name.split(".").pop();
          if (ext === "css") {
            return "assets/[name]-[hash].css";
          }
          return "assets/[name]-[hash].[ext]";
        },
      },
    },
  },
  // Ensure proper MIME types
  server: {
    headers: {
      "Content-Type": "application/javascript",
    },
  },
});
