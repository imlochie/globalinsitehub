import { CircleDashed, ExternalLink, Info, Radio, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { BriefingError, BriefingLoading, EmptyState, InlineUpdating } from '@/components/briefing-states';
import { SourceStatus } from '@/components/source-status';
import { useBriefing } from '@/hooks/use-briefing';
import { formatAbsoluteTime, statusLabel, type BriefingSource } from '@/lib/monitoring';

export default function SourcesPage() {
  const { briefing, isLoading, isError, isFetching, refetch } = useBriefing(60);
  const [filter, setFilter] = useState<'all' | BriefingSource['status']>('all');
  useEffect(() => { document.title = 'Sources — Signalwatch'; }, []);
  const sources = useMemo(() => (briefing?.sources ?? []).filter((source: BriefingSource) => filter === 'all' || source.status === filter), [briefing, filter]);
  const online = briefing?.sources.filter((source: BriefingSource) => source.status === 'online').length ?? 0;
  const unavailable = briefing?.sources.filter((source: BriefingSource) => source.status === 'unavailable').length ?? 0;
  const configured = briefing?.sources.filter((source: BriefingSource) => source.status === 'configured').length ?? 0;
  const providerNeeded = briefing?.sources.filter((source: BriefingSource) => source.status === 'provider-needed').length ?? 0;
  const notIntegrated = briefing?.sources.filter((source: BriefingSource) => source.status === 'not-integrated').length ?? 0;

  return <div className="signal-rise mx-auto max-w-[1500px] px-4 pb-12 sm:px-6 lg:px-9">
    <section className="flex flex-col gap-5 border-b border-border py-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">provenance ledger</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Sources & attribution</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Know which public sources answered, which did not, and where each signal came from.</p></div><div className="flex items-center gap-3">{isFetching && !isLoading && <InlineUpdating />}<Link href="/sectors?view=workspace#sector-operations" data-testid="link-source-back-workspace" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Workspace <ExternalLink className="ml-1 inline size-3.5" /></Link></div></section>
    {isLoading && <div className="py-8"><BriefingLoading /></div>}
    {isError && !isLoading && <div className="py-8"><BriefingError onRetry={() => void refetch()} /></div>}
    {briefing && <section className="py-7">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
        <SourceMetric icon={<ShieldCheck className="size-4" />} label="Online" value={online} tone="green" />
        <SourceMetric icon={<TriangleAlert className="size-4" />} label="Unavailable" value={unavailable} tone="red" />
        <SourceMetric icon={<Radio className="size-4" />} label="Configured" value={configured} tone="neutral" />
        <SourceMetric icon={<Info className="size-4" />} label="Provider needed" value={providerNeeded} tone="amber" />
        <SourceMetric icon={<CircleDashed className="size-4" />} label="Not integrated" value={notIntegrated} tone="neutral" />
        <SourceMetric icon={<Radio className="size-4" />} label="Last checked" value={formatAbsoluteTime(briefing.generatedAt)} tone="neutral" text />
      </div>
      <div className="mt-8 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Source registry</h2><p className="mt-1 text-xs text-muted-foreground">{briefing.sources.length} records in the current briefing · refreshed {formatAbsoluteTime(briefing.generatedAt)}</p></div><div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">{(['all', 'online', 'unavailable', 'configured', 'provider-needed', 'not-integrated'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} data-testid={`button-source-filter-${value}`} className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${filter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{statusLabel(value)}</button>)}</div></div>
      {sources.length === 0 ? <div className="mt-5"><EmptyState title="No sources in this view" detail={filter === 'all' ? 'The endpoint returned no source status records.' : `There are no ${statusLabel(filter)} sources in this briefing.`} /></div> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sources.map((source: BriefingSource) => <SourceStatus key={source.id} source={source} detailed />)}</div>}
      <div className="mt-10 rounded-xl border border-border bg-muted/25 p-5"><div className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground"><Info className="size-3.5" /></span><div><h2 className="text-sm font-semibold">Attribution is part of the signal</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Signalwatch preserves each source name, attribution, timestamp, and original URL. “Unavailable” means a configured source did not answer; “Provider needed” means no verified provider is connected; “Not integrated” means public data exists but this app does not yet calculate or display that layer.</p></div></div></div>
    </section>}
  </div>;
}

function SourceMetric({ icon, label, value, tone, text = false }: { icon: ReactNode; label: string; value: number | string; tone: 'green' | 'red' | 'amber' | 'neutral'; text?: boolean }) {
  const colors = { green: 'text-emerald-700 dark:text-emerald-300', red: 'text-destructive', amber: 'text-amber-700 dark:text-amber-300', neutral: 'text-foreground' };
  return <div className="bg-card px-4 py-4 sm:px-5"><div className={`flex items-center gap-2 text-xs font-semibold ${colors[tone]}`}>{icon}{label}</div><div className="mt-2 text-xl font-semibold tracking-tight">{text ? value : Number(value).toLocaleString()}</div></div>;
}