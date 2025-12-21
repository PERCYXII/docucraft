
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env': {
        API_KEY: JSON.stringify(env.API_KEY || env.VITE_API_KEY),
        SUPABASE_URL: JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
        SUPABASE_ANON_KEY: JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
    },
  };
});
