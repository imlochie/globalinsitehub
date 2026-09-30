import { ArrowUpRight, Clock3, ExternalLink, ImageOff, Layers3, ListFilter, Radio, Search, Signal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { BriefingError, BriefingLoading, EmptyState, InlineUpdating } from '@/components/briefing-states';
import { SourceStatus } from '@/components/source-status';
import { useBriefing } from '@/hooks/use-briefing';
import { displayLanguage, formatAbsoluteTime, formatRelativeTime, type BriefingHeadline, type BriefingSource } from '@/lib/monitoring';

const liveChannels = [
  { name: 'BBC World Service', mark: 'BBC', detail: 'Global radio', url: 'https://www.bbc.co.uk/worldserviceradio' },
  { name: 'DW News', mark: 'DW', detail: 'International video', url: 'https://www.youtube.com/channel/UCknLrEdhRCp1aegomQRaCZg/live' },
  { name: 'FRANCE 24', mark: 'F24', detail: 'Continuous news', url: 'https://www.france24.com/en/live' },
  { name: 'Al Jazeera English', mark: 'AJ', detail: 'Global live TV', url: 'https://www.aljazeera.com/live' },
];

export default function MonitoringPage() {
  const { briefing, isLoading, isError, isFetching, refetch } = useBriefing(40);
  const [search, setSearch] = useState('');
  useEffect(() => { document.title = 'Workspace — Signalwatch'; }, []);

  const filteredHeadlines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!briefing) return [];
    return briefing.headlines.filter((headline: BriefingHeadline) => !normalized || [headline.title, headline.source, headline.summary, headline.language].join(' ').toLowerCase().includes(normalized));
  }, [briefing, search]);
  return (
    <div className="signal-rise mx-auto max-w-[1500px] px-4 pb-12 sm:px-6 lg:px-9">
      <section className="flex flex-col gap-5 border-b border-border py-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-600" /> monitoring workspace
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">See the signal. Keep the source.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A live read of public broadcasts and reported events, arranged for the first five minutes of a story.</p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <InlineUpdating />}
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">{briefing ? `briefing ${formatAbsoluteTime(briefing.generatedAt)}` : 'waiting for briefing'}</span>
        </div>
      </section>

      {isLoading && <div className="py-8"><BriefingLoading /></div>}
      {isError && !isLoading && <div className="py-8"><BriefingError onRetry={() => void refetch()} /></div>}
      {briefing && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4" aria-label="Briefing summary">
            <Metric label="Headlines" value={briefing.headlineCount} detail="public items" />
            <Metric label="Events" value={briefing.eventCount} detail="reported now" />
            <Metric label="Sources online" value={briefing.sourcesOnline} detail={`of ${briefing.sources.length || '—'} checked`} accent />
            <Metric label="Last generated" value={formatRelativeTime(briefing.generatedAt)} detail="auto refresh · 60s" text />
          </section>

          <section className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">Current headlines</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{filteredHeadlines.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Every headline links directly to the publishing source.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-briefing" placeholder="Filter this briefing" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:ring-2 focus:ring-ring/20" />
                </div>
              </div>
              {filteredHeadlines.length === 0 ? (
                <EmptyState title={search ? 'No matching headlines' : 'No headlines returned'} detail={search ? 'Try a source name, language, or a shorter phrase.' : 'The current public briefing contains no headline items. Signalwatch will not fill the gap with placeholder stories.'} />
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {filteredHeadlines.map((headline: BriefingHeadline) => <HeadlineRow key={headline.id} headline={headline} />)}
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <div>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Live channels</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Curated public shortcuts</p>
                  </div>
                  <Radio className="size-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {liveChannels.map((channel) => (
                    <a key={channel.name} href={channel.url} target="_blank" rel="noreferrer" data-testid={`link-live-channel-${channel.mark.toLowerCase()}`} className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/30 hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-medium text-foreground">{channel.mark}</span>
                        <ExternalLink className="size-3 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-3 truncate text-xs font-medium">{channel.name}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{channel.detail}</div>
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Shortcuts open the broadcaster. They are curated entry points, not a live-status guarantee.</p>
              </div>

              <div>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Source pulse</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Availability in this briefing</p>
                  </div>
                  <Link href="/sources" data-testid="link-view-all-sources" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">View all</Link>
                </div>
                <div className="space-y-2">
                  {briefing.sources.length === 0 ? <EmptyState title="No sources reported" detail="The endpoint returned no source health records." /> : briefing.sources.slice(0, 4).map((source: BriefingSource) => <SourceStatus key={source.id} source={source} />)}
                </div>
              </div>
            </aside>
          </section>

          <ProviderNotice />
        </>
      )}
    </div>
  );
}

function Metric({ label, value, detail, accent = false, text = false }: { label: string; value: number | string; detail: string; accent?: boolean; text?: boolean }) {
  return <div className={`bg-card px-4 py-4 sm:px-5 ${accent ? 'relative overflow-hidden' : ''}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{text ? value : value.toLocaleString()}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>{accent && <Sparkles className="absolute -right-1 -top-1 size-14 text-emerald-700/5 dark:text-emerald-300/5" />}</div>;
}

function HeadlineRow({ headline }: { headline: BriefingHeadline }) {
  return (
    <article className="group flex gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5" data-testid={`headline-${headline.id}`}>
      <div className="hidden size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:block">
        {headline.imageUrl ? <img src={headline.imageUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><ImageOff className="size-4" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><span className="font-semibold text-foreground/70">{headline.source}</span><span className="text-border">/</span><span>{displayLanguage(headline.language)}</span><span className="text-border">/</span><span>{formatRelativeTime(headline.publishedAt)}</span></div>
        <a href={headline.url} target="_blank" rel="noreferrer" data-testid={`link-headline-${headline.id}`} className="mt-2 block text-sm font-semibold leading-5 tracking-[-0.01em] group-hover:text-foreground/75">{headline.title}</a>
        {headline.summary && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{headline.summary}</p>}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" /> {formatAbsoluteTime(headline.publishedAt)} <ExternalLink className="ml-1 size-3 opacity-0 transition-opacity group-hover:opacity-60" /></div>
      </div>
    </article>
  );
}

function ProviderNotice() {
  return <section className="mt-10 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Layers3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><h2 className="text-xs font-semibold">Additional layers are not connected</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground">AIS vessel tracking, CCTV streams, and other provider-backed layers will appear here only when configured. Signalwatch does not fabricate coverage.</p></div></div><Link href="/sources" data-testid="link-provider-status" className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">Review providers <ArrowUpRight className="ml-1 inline size-3" /></Link></section>;
}