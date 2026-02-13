import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  root: '.', 
  plugins: [
    tailwindcss(),
  ],
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        embed: path.resolve(__dirname, 'embed.html'),
      },
      output: {
        manualChunks: {
          'monaco': ['monaco-editor'],
        }
      }
    },
    chunkSizeWarningLimit: 4000,
  },
  resolve: {
    alias: {
      'utils': path.resolve(__dirname, './src/utils'),
      'controllers/': path.resolve(__dirname, './src/controllers/'),
      'lsp/': path.resolve(__dirname, './src/lsp/'),
      'analysis/': path.resolve(__dirname, './src/analysis/'),
      'analysis': path.resolve(__dirname, './src/analysis.ts'),
      'reference/': path.resolve(__dirname, './src/reference/'),
      'reference': path.resolve(__dirname, './src/reference.js'),
      'runtime/': path.resolve(__dirname, './src/runtime/'),
      'runtime': path.resolve(__dirname, './src/runtime.js'),
      'persistence/': path.resolve(__dirname, './src/persistence/'),
      'persistence': path.resolve(__dirname, './src/persistence.js'),
    },
  },
})
