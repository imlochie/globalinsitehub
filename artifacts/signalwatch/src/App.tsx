import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { GlobalLayerProvider } from '@/components/global-layer-provider';
import { SignalShell } from '@/components/shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import EventMapPage from '@/pages/event-map';
import SourcesPage from '@/pages/sources';
import SectorsPage from '@/pages/sectors';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <SignalShell>
        <Switch>
          <Route path="/" component={WorkspaceSectorEntry} />
          <Route path="/map" component={EventMapPage} />
          <Route path="/sectors" component={() => <SectorsPage />} />
          <Route path="/sources" component={SourcesPage} />
          <Route component={NotFound} />
        </Switch>
      </SignalShell>
    </RoutedErrorBoundary>
  );
}

function WorkspaceSectorEntry() {
  return <SectorsPage initialView="workspace" />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLayerProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </GlobalLayerProvider>
    </QueryClientProvider>
  );
}

export default App;
