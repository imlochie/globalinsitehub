import { CheckCircle2, CircleDashed, ExternalLink, ShieldAlert } from 'lucide-react';
import type { BriefingSource } from '@/lib/monitoring';
import { formatAbsoluteTime, statusLabel } from '@/lib/monitoring';

export function SourceStatus({ source, detailed = false }: { source: BriefingSource; detailed?: boolean }) {
  const statusClass = source.status === 'online'
    ? 'border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-300'
    : source.status === 'provider-needed'
      ? 'border-amber-600/25 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      : source.status === 'unavailable'
        ? 'border-destructive/20 bg-destructive/5 text-destructive'
        : 'border-border bg-muted/60 text-muted-foreground';
  const Icon = source.status === 'online'
    ? CheckCircle2
    : source.status === 'unavailable'
      ? ShieldAlert
      : CircleDashed;
  return (
    <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20" data-testid={`source-card-${source.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{source.name}</h3>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${statusClass}`} data-testid={`status-source-${source.id}`}>
              <Icon className="size-2.5" /> {statusLabel(source.status)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{source.category}</p>
        </div>
        <a href={source.url} target="_blank" rel="noreferrer" data-testid={`link-source-${source.id}`} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open ${source.name} source`}>
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{source.message}</p>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
        <span>{source.itemsReceived} items received</span>
        <span>{detailed ? formatAbsoluteTime(source.checkedAt) : `checked ${formatAbsoluteTime(source.checkedAt)}`}</span>
      </div>
      {detailed && <div className="mt-2 text-[10px] text-muted-foreground">Attribution: <span className="text-foreground/70">{source.attribution}</span></div>}
    </article>
  );
}