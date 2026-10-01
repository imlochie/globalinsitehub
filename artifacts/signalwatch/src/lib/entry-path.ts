/**
 * Entry-path normalization for packaged shells.
 *
 * Tauri loads the app as `index.html`, so `location.pathname` is
 * `/index.html`. The router declares `/`, `/map`, `/sectors` and `/sources`,
 * none of which match, so a packaged build would open on the Not Found page
 * even though everything else is working.
 *
 * Returns the directory path to rewrite to, or null when the current path is
 * already a normal route and must be left alone.
 */
export function normalizeEntryPath(pathname: string): string | null {
  if (!pathname.endsWith('/index.html')) return null;
  return pathname.slice(0, -'index.html'.length);
}
