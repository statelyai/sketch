import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

/**
 * Extra directories the dev server may read machine files from, via `/@fs/`.
 *
 * Vite sandboxes `/@fs` to the project root by default, and that default is right: anything the dev
 * server can read, a page it serves can read. The `/graph` route needs to import machine files from
 * sibling repositories, so those roots are opted in EXPLICITLY here rather than by disabling the
 * sandbox (`fs.strict: false`), which would expose the whole filesystem.
 *
 * Set `SKETCH_FS_ALLOW` to a colon-separated list of absolute paths to point it elsewhere. It only
 * affects `vite dev` — `/@fs` does not exist in a production build.
 */
const extraFsRoots = (process.env.SKETCH_FS_ALLOW ?? '')
  .split(':')
  .map((entry) => entry.trim())
  .filter(Boolean);

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        // The workspace that holds this clone and its sibling repos.
        fileURLToPath(new URL('..', import.meta.url)),
        ...extraFsRoots,
      ],
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
