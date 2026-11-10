import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss()
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: supabaseUrl
      ? {
          proxy: {
            '/supabase-proxy': {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              ws: true,
              rewrite: (requestPath) => requestPath.replace(/^\/supabase-proxy/, ''),
            },
          },
        }
      : undefined,
  }
})
