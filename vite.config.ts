import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro({
      serverDir: 'server',
      rollupConfig: {
        external: [/^@sentry\//, /^@statelyai\/graph/, /^fast-xml-parser/],
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    // Cloudflare plugin only for builds — in dev it replaces the SSR environment
    // with CloudflareDevEnvironment which doesn't register with Nitro's worker,
    // causing fetchViteEnv("ssr") to 404.
    ...(command === 'build'
      ? [cloudflare({ viteEnvironment: { name: 'ssr' } })]
      : []),
    tanstackStart(),
    viteReact(),
  ],
}));
