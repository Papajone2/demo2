import path from 'path';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const require = createRequire(import.meta.url);
mkdirSync(path.resolve(import.meta.dirname, 'public'), { recursive: true });
// Recreated from the pinned package at dev/build startup, never checked into Git.
copyFileSync(
  path.join(path.dirname(require.resolve('monero-ts/package.json')), 'dist/monero.worker.js'),
  path.resolve(import.meta.dirname, 'public/monero.worker.js'),
);
copyFileSync(
  path.join(path.dirname(require.resolve('monero-ts/package.json')), 'dist/monero.worker.js.LICENSE.txt'),
  path.resolve(import.meta.dirname, 'public/monero.worker.js.LICENSE.txt'),
);

export default defineConfig({
  base: basePath,
  plugins: [
    nodePolyfills({ include: ['http', 'https', 'fs', 'stream', 'util', 'path', 'assert', 'buffer', 'process', 'crypto'] }),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    commonjsOptions: { transformMixedEsModules: true },
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
