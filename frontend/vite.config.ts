import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sentryVitePlugin({
    org: "scarlatti",
    project: "veva-frontend"
  })],

  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler"
      }
    }
  },

  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true,
    }
  },

  build: {
    sourcemap: true
  }
})