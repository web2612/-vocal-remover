import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin to exclude large onnxruntime WASM binaries (>25MB) from local build output.
// WASM binaries are loaded dynamically from jsDelivr CDN via ort.env.wasm.wasmPaths,
// ensuring strict adherence to Cloudflare Pages free tier 25 MiB asset limit.
function excludeOnnxWasm(): Plugin {
  return {
    name: 'exclude-onnx-wasm',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.includes('ort-wasm') && fileName.endsWith('.wasm')) {
          delete bundle[fileName];
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  worker: { format: 'es', plugins: () => [excludeOnnxWasm()] },
  plugins: [
    tailwindcss(),
    react(),
    excludeOnnxWasm(),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
})
