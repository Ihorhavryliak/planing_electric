import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function readPort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port "${value}". Expected an integer from 1 to 65535.`);
  }

  return port;
}

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...process.env,
  };
  const webPort = readPort(env.WEB_PORT, 3004);
  const apiPort = readPort(env.API_PORT, 5004);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['@drawmyplace/calculations'],
    },
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: webPort,
      strictPort: true,
    },
    test: {
      environment: 'node',
    },
  };
});
