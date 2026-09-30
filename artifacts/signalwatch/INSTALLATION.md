# Install Signalwatch

Signalwatch is the existing Vite web app, packaged as a Progressive Web App (PWA). The installed app uses the same routes and live API as the website; it is not a second product or a native binary.

## Windows: Microsoft Edge or Chrome

1. Open the deployed Signalwatch site over HTTPS in Microsoft Edge or Chrome.
2. Select **Install** in the Signalwatch header. If the browser offers its native install prompt, accept it.
3. If no prompt appears, use the browser menu:
   - **Edge:** **Settings and more → Apps → Install this site as an app**.
   - **Chrome:** choose **Install Signalwatch** or **Install page as app** from the address-bar install icon or browser menu.
4. Launch Signalwatch from the Start menu or the browser's installed-apps list.

The PWA opens in a standalone app window. It is not an `.exe` installer; Electron and Tauri packaging are not needed for this experience.

## iPhone or iPad: Safari Home Screen app

1. Open the deployed Signalwatch site over HTTPS in **Safari**. An in-app browser may not show the required option.
2. Tap **Share**.
3. Choose **Add to Home Screen**, then tap **Add**.
4. Open Signalwatch from its Home Screen icon.

Safari on iOS does not expose the Chromium `beforeinstallprompt` event. The Signalwatch **Install** button therefore displays these manual Safari steps instead of pretending to open a native prompt. The app uses the standalone display setting and a dedicated 180×180 Apple touch icon.

## Offline behavior

- After the first successful online load and service-worker installation, the app shell and its built assets can be loaded offline. Navigating to `/` or `/map` falls back to the cached app shell.
- Provider and API responses are **not** cached. API requests use a network-only service-worker strategy, so offline mode does not present old provider data as live.
- Signalwatch displays an offline notice. Any records still visible were loaded earlier in the current session; reconnect to resume live updates.
- The install control remains visible in development, but explains that installation and the production service worker should be tested from the deployed HTTPS build. The Vite development server does not register that worker.

## Native iOS packaging

The existing Expo Mobile artifact is a possible starting point for future native iOS work, but its current build script creates a static Expo Go deployment, not a signed iOS app. The app configuration does not currently declare an iOS bundle identifier, and this repository has no Xcode project.

Native App Store or TestFlight distribution requires an Apple Developer account and a signed native build. That distribution path is not included or represented as free here. The Safari-installed PWA is the zero-cost iPhone installation path; no EAS service or native distribution dependency was added.

## Validate the PWA

Run from the workspace root:

```sh
pnpm --filter @workspace/signalwatch run typecheck
pnpm --filter @workspace/signalwatch run test
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/signalwatch run build
pnpm --filter @workspace/signalwatch run verify:pwa
```

The build generates `dist/public/manifest.webmanifest`, `dist/public/sw.js`, and the PWA/iOS icons. The verification command checks the manifest routes and display mode, icon files and dimensions, iOS metadata, service-worker output, and the network-only API configuration.