import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetMonitoringBriefingQueryKey,
  useGetMonitoringBriefing,
} from "@workspace/api-client-react";

/**
 * Guards against a second copy of @tanstack/react-query.
 *
 * @workspace/api-client-react is consumed as source, so its own node_modules
 * resolution applies. When pnpm stored two peer variants of react-query (one
 * built against react 19.1.0, one against 19.2.3), the provider and the
 * generated hooks ended up with different QueryClientContext objects, and
 * every data component threw "No QueryClient set, use QueryClientProvider to
 * set one" despite a provider being mounted directly above it.
 *
 * Rendering a generated hook inside the app's own provider fails loudly if
 * those instances ever diverge again.
 */
function UsesGeneratedHook() {
  const params = { limit: 1 };
  const query = useGetMonitoringBriefing(params, {
    query: {
      queryKey: getGetMonitoringBriefingQueryKey(params),
      enabled: false,
      retry: false,
    },
  });
  return <div data-state={query.status}>generated hook mounted</div>;
}

test("the generated client shares the app's QueryClient instance", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <UsesGeneratedHook />
    </QueryClientProvider>,
  );

  assert.match(markup, /generated hook mounted/);
});

test("react-query resolves to a single module instance", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const fromApp = require.resolve("@tanstack/react-query");
  const fromClient = require.resolve("@tanstack/react-query", {
    paths: [new URL("../../../lib/api-client-react/src", import.meta.url).pathname],
  });
  assert.equal(
    fromApp,
    fromClient,
    "the app and the generated client must resolve the same react-query",
  );
});
