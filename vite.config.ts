import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform'))
              return 'forms';
            if (id.includes('date-fns')) return 'dates';
            return 'vendor';
          }
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
