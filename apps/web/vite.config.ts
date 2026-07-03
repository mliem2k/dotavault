import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    // Local mirror of the /df Pages Function → Valve datafeed.
    proxy: {
      '/df': {
        target: 'https://www.dota2.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/df/, '/datafeed'),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; dotavault/1.0)',
          referer: 'https://www.dota2.com/heroes',
        },
      },
    },
  },
})
