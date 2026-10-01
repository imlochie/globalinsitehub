import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { VitePWA } from 'vite-plugin-pwa';

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

/**
 * Set by the Tauri build (scripts/build-frontend.mjs). The desktop bundle is
 * loaded from local resources and talks to a bundled API, so a service worker
 * adds nothing and actively breaks rebuilds by serving a cached document.
 */
const isDesktopBuild = process.env.SIGNALWATCH_DESKTOP_BUILD === '1';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: 'autoUpdate',
      /**
       * The packaged desktop shell must not keep a service worker.
       *
       * Tauri serves the app from `tauri.localhost`, a `*.localhost` origin,
       * which WebView2 treats as a secure context — so the worker registers
       * and then precaches `index.html` and the hashed assets. Every later
       * launch is served the cached document, which still points at the
       * previous bundle, so a freshly built executable silently runs stale
       * frontend code.
       *
       * `selfDestroying` emits a worker that unregisters itself and clears its
       * caches. That matters more than simply not registering one: machines
       * that already have a worker installed need something that actively
       * cleans up, and the browser always revalidates the worker script, so
       * the replacement is picked up on the next launch.
       *
       * Normal web builds are untouched and keep the full PWA behaviour.
       */
      selfDestroying: isDesktopBuild,
      includeAssets: [
        'favicon.svg',
        'pwa-192.png',
        'pwa-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        id: '/',
        name: 'Signalwatch',
        short_name: 'Signalwatch',
        description:
          'A map-first workspace for monitoring public information signals.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#070a10',
        theme_color: '#070a10',
        orientation: 'any',
        categories: ['news', 'utilities'],
        prefer_related_applications: false,
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        shortcuts: [
          {
            name: 'Live event map',
            short_name: 'Map',
            description: 'Open the Signalwatch event map.',
            url: '/map',
            icons: [
              {
                src: '/pwa-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,webmanifest,woff2,woff,ttf}',
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
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
    /**
     * A second copy of react-query means a second QueryClientContext, so the
     * provider sets a client the generated hooks never see and every data
     * component throws "No QueryClient set". It happened here because
     * @workspace/api-client-react is consumed as source, so its own
     * node_modules resolution applied.
     */
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
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
