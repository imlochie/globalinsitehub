import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function BriefingLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'} aria-label="Loading monitoring briefing" data-testid="state-loading-briefing">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex gap-2"><div className="h-2 w-14 rounded bg-muted" /><div className="h-2 w-20 rounded bg-muted" /></div>
          <div className="h-4 w-[82%] rounded bg-muted" />
          <div className="mt-2 h-3 w-[58%] rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function BriefingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center" data-testid="state-error-briefing">
      <AlertTriangle className="mx-auto size-5 text-destructive" />
      <h3 className="mt-3 text-sm font-semibold">The briefing could not be retrieved</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">The public monitoring endpoint did not respond. No fallback items are being shown.</p>
      <button type="button" onClick={onRetry} data-testid="button-retry-briefing" className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
        <RefreshCw className="size-3.5" /> Try again
      </button>
    </div>
  );
}

export function InlineUpdating() {
  return <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="status-refreshing"><LoaderCircle className="size-3 animate-spin" /> updating</span>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-10 text-center" data-testid="state-empty">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"><span className="size-2 rounded-full bg-muted-foreground/40" /></div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}