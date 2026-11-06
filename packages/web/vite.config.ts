import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"
import packageJson from "../../package.json" with { type: "json" }

const webPort = Number(process.env.WEB_PORT) || 3000
const socketTarget = `http://127.0.0.1:${Number(process.env.SOCKET_PORT) || 3001}`
const serverOptions = {
  port: webPort,
  host: "0.0.0.0",
  proxy: {
    "/ws": { target: socketTarget, ws: true },
    "/api": { target: socketTarget },
    "/uploads": { target: socketTarget },
  },
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      routeToken: "layout",
      routesDirectory: "./src/pages",
      generatedRouteTree: "./src/route.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@razzia/web": fileURLToPath(new URL("./src", import.meta.url)),
      "@razzia/common": fileURLToPath(
        new URL("../common/src", import.meta.url),
      ),
      "@razzia/socket": fileURLToPath(
        new URL("../socket/src", import.meta.url),
      ),
    },
  },
  server: serverOptions,
  preview: serverOptions,
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
