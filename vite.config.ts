
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: cast process to any to resolve TS error 'Property cwd does not exist on type Process'
  // in environments where the global process type is restricted.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env': {
        API_KEY: JSON.stringify(env.GEMINI_API_KEY),
        SUPABASE_URL: JSON.stringify(env.SUPABASE_URL),
        SUPABASE_ANON_KEY: JSON.stringify(env.SUPABASE_ANON_KEY),
      },
    },
  };
});
