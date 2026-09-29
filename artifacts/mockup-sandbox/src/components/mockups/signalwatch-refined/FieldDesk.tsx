import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronDown,
  Clock3,
  Compass,
  Fingerprint,
  Globe2,
  Image,
  Link2,
  Map,
  Maximize2,
  Network,
  Pause,
  Play,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Satellite,
  Wallet,
  Waypoints,
} from "lucide-react";

type SectorId =
  | "cameras"
  | "identity"
  | "crypto"
  | "network"
  | "imagery"
  | "spectrum"
  | "movement"
  | "fisherman"
  | "catalogue";

type ViewMode = "globe" | "map" | "network" | "spectrum";

const sectors: {
  id: SectorId;
  index: string;
  label: string;
  title: string;
  icon: typeof Globe2;
  status: "linked" | "preview";
  description: string;
  sample: string;
}[] = [
  { id: "cameras", index: "01", label: "Cameras", title: "Camera intelligence", icon: Camera, status: "linked", description: "Explore public camera catalogues by location and provider.", sample: "Brisbane, Queensland · sample" },
  { id: "identity", index: "02", label: "Identity", title: "Identity signals", icon: Fingerprint, status: "preview", description: "Organize public profiles and authorized source types.", sample: "signal.sample · illustrative alias" },
  { id: "crypto", index: "03", label: "Blockchain", title: "Blockchain tracing", icon: Wallet, status: "preview", description: "Inspect public on-chain transactions and relationships.", sample: "Ethereum · sample address" },
  { id: "network", index: "04", label: "Network", title: "Network exposure", icon: Network, status: "preview", description: "Document exposed services on authorized assets.", sample: "example.org · reserved example" },
  { id: "imagery", index: "05", label: "Imagery", title: "Image geolocation", icon: Image, status: "preview", description: "Compare visible landmarks and metadata as location clues.", sample: "Wellington · sample region" },
  { id: "spectrum", index: "06", label: "Spectrum", title: "Radio-frequency intelligence", icon: Radio, status: "preview", description: "Explore modeled reception and supported frequencies.", sample: "433.92 MHz · illustrative" },
  { id: "movement", index: "07", label: "Movement", title: "Movement intelligence", icon: Activity, status: "preview", description: "Review aggregate public movement indicators by region.", sample: "Central district · sample" },
  { id: "fisherman", index: "08", label: "Fisherman", title: "Fisherman link intelligence", icon: Link2, status: "preview", description: "Examine link relationships in a controlled workflow.", sample: "example.org · no request sent" },
  { id: "catalogue", index: "09", label: "Catalogue", title: "Public-record catalogue", icon: BookOpen, status: "preview", description: "Search official records while retaining source attribution.", sample: "Registry 01 · illustrative" },
];

const updates: { id: string; sector: SectorId; place: string; title: string; note: string; time: string }[] = [
  { id: "S—01", sector: "cameras", place: "BRISBANE · AU", title: "Camera catalogue marker added", note: "Illustrative public-location update", time: "09:42" },
  { id: "S—02", sector: "crypto", place: "ETHEREUM · SAMPLE", title: "Wallet relationship highlighted", note: "Simulated on-chain path", time: "09:37" },
  { id: "S—03", sector: "imagery", place: "WELLINGTON · SAMPLE", title: "Location clue added", note: "Illustrative landmark match", time: "09:31" },
  { id: "S—04", sector: "network", place: "EXAMPLE.ORG · RESERVED", title: "Service review staged", note: "No network request or scan", time: "09:24" },
  { id: "S—05", sector: "spectrum", place: "433.92 MHZ · SAMPLE", title: "Reception contour refreshed", note: "Modeled preview, not receiver data", time: "09:18" },
  { id: "S—06", sector: "catalogue", place: "REGISTRY 01 · SAMPLE", title: "Public record preview indexed", note: "Illustrative catalogue entry", time: "09:10" },
];

const locations: { id: SectorId; x: number; y: number }[] = [
  { id: "cameras", x: 524, y: 349 },
  { id: "identity", x: 291, y: 194 },
  { id: "crypto", x: 404, y: 174 },
  { id: "network", x: 553, y: 213 },
  { id: "imagery", x: 555, y: 362 },
  { id: "spectrum", x: 573, y: 229 },
  { id: "movement", x: 470, y: 259 },
  { id: "fisherman", x: 421, y: 187 },
  { id: "catalogue", x: 533, y: 331 },
];

export function FieldDesk() {
  const [selectedId, setSelectedId] = useState<SectorId>("imagery");
  const [view, setView] = useState<ViewMode>("globe");
  const [search, setSearch] = useState("");
  const [activeUpdate, setActiveUpdate] = useState(2);
  const [replaying, setReplaying] = useState(false);
  const selected = sectors.find((sector) => sector.id === selectedId) ?? sectors[4];
  const filteredSectors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sectors.filter((sector) => !query || `${sector.label} ${sector.title} ${sector.description}`.toLowerCase().includes(query));
  }, [search]);

  useEffect(() => {
    if (!replaying) return;
    const timer = window.setInterval(() => {
      setActiveUpdate((index) => (index + 1) % updates.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [replaying]);

  useEffect(() => {
    setSelectedId(updates[activeUpdate]?.sector ?? "imagery");
  }, [activeUpdate]);

  function chooseSector(id: SectorId) {
    setSelectedId(id);
    const updateIndex = updates.findIndex((update) => update.sector === id);
    if (updateIndex >= 0) setActiveUpdate(updateIndex);
  }

  return (
    <main className="min-h-[100dvh] bg-[#080c12] text-[#d9e2e8]" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(rgba(145,177,193,.18) .6px, transparent .6px)", backgroundSize: "5px 5px" }} />
      <div className="relative flex min-h-[100dvh]">
        <aside className="hidden w-[238px] shrink-0 flex-col border-r border-white/[0.075] bg-[#0a0f16] px-4 py-5 xl:flex">
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100">
              <Waypoints size={18} strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[13px] font-semibold tracking-[-0.03em] text-slate-100">Signalwatch</div>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[.17em] text-slate-500">Field workspace</div>
            </div>
          </div>

          <div className="mt-9 flex items-center justify-between px-2">
            <span className="font-mono text-[8px] uppercase tracking-[.17em] text-slate-500">Intelligence sectors</span>
            <span className="font-mono text-[9px] text-slate-600">09</span>
          </div>
          <label className="relative mt-3 block">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter sectors" aria-label="Filter sectors" className="h-9 w-full rounded-lg border border-white/[0.09] bg-white/[0.025] pl-9 pr-3 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-200/30" />
          </label>
          <nav className="mt-3 space-y-1" aria-label="Intelligence sectors">
            {filteredSectors.map((sector) => {
              const Icon = sector.icon;
              const isActive = sector.id === selectedId;
              return (
                <button key={sector.id} type="button" onClick={() => chooseSector(sector.id)} aria-pressed={isActive} className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors ${isActive ? "border-cyan-200/[0.17] bg-cyan-200/[0.075] shadow-[inset_2px_0_0_rgba(119,225,236,.68)]" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.025]"}`}>
                  <span className="w-5 font-mono text-[8px] text-slate-600">{sector.index}</span>
                  <Icon size={14} strokeWidth={1.7} className={isActive ? "text-cyan-100" : "text-slate-500"} />
                  <span className={`min-w-0 flex-1 truncate text-[10px] ${isActive ? "font-medium text-slate-100" : "text-slate-400"}`}>{sector.label}</span>
                  <span className={`size-1.5 shrink-0 rounded-full ${sector.status === "linked" ? "bg-cyan-300" : "bg-slate-700"}`} />
                </button>
              );
            })}
            {filteredSectors.length === 0 && <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[10px] text-slate-500">No matching sector.</div>}
          </nav>
          <div className="mt-auto space-y-4 pt-8">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.018] p-3.5">
              <div className="flex items-center gap-2 text-cyan-100/80">
                <ShieldCheck size={13} />
                <span className="font-mono text-[8px] uppercase tracking-[.12em]">Source-first by design</span>
              </div>
              <p className="mt-2 text-[9px] leading-[1.65] text-slate-500">Preview sectors are clearly marked. Signalwatch never fills missing coverage with invented data.</p>
            </div>
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
              <Settings2 size={14} /><span className="text-[10px]">Display settings</span><ChevronDown size={12} className="ml-auto -rotate-90" />
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-[62px] items-center justify-between border-b border-white/[0.075] px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 text-[10px]">
              <span className="text-slate-500 xl:hidden">Signalwatch</span>
              <span className="hidden text-slate-600 xl:inline">WORKSPACE</span>
              <span className="text-slate-700">/</span>
              <span className="truncate font-medium text-slate-300">Global field</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="hidden items-center gap-2 font-mono text-[8px] uppercase tracking-[.12em] text-slate-500 md:flex">
                <span className="size-1.5 rounded-full bg-amber-300" />
                Sample environment
              </span>
              <span className="h-4 w-px bg-white/10" />
              <span className="flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.045] px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[.1em] text-cyan-100/80">
                <span className="size-1.5 rounded-full bg-cyan-300" /> 1 catalogue linked
              </span>
              <button type="button" aria-label="Settings" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"><Settings2 size={15} /></button>
            </div>
          </header>

          <div className="mx-auto max-w-[1800px] px-4 pb-7 pt-5 sm:px-6 lg:px-8 lg:pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.18em] text-slate-500">
                  <span className="text-cyan-200/75">Signalwatch / 01</span><span className="text-slate-700">—</span><span>Multi-sector intelligence</span>
                </div>
                <h1 className="mt-2 text-[27px] font-medium leading-none tracking-[-.055em] text-slate-100 sm:text-[32px]">One global picture<span className="text-cyan-200/80">.</span></h1>
                <p className="mt-2 text-[11px] text-slate-500">A source-aware field across nine intelligence sectors.</p>
              </div>
              <div className="flex items-center gap-5 pb-0.5 sm:gap-7">
                <HeaderStat value="09" label="sectors" />
                <span className="h-7 w-px bg-white/[0.08]" />
                <HeaderStat value="01" label="linked catalogue" />
                <span className="h-7 w-px bg-white/[0.08]" />
                <HeaderStat value="08" label="concept views" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
              <section className="min-w-0 overflow-hidden rounded-xl border border-white/[0.085] bg-[#0a1018] shadow-[0_24px_70px_rgba(0,0,0,.18)]">
                <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 border-b border-white/[0.075] px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <Globe2 size={14} className="text-cyan-200" />
                    <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-300">Global workspace</span>
                    <span className="hidden h-3 w-px bg-white/10 sm:block" />
                    <span className="hidden font-mono text-[8px] uppercase tracking-[.1em] text-amber-100/65 sm:block">Illustrative field</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-white/[0.07] bg-black/20 p-1" role="group" aria-label="Visualization mode">
                      {([
                        ["globe", Globe2, "Globe"],
                        ["map", Map, "Map"],
                        ["network", Network, "Network"],
                        ["spectrum", Signal, "Spectrum"],
                      ] as const).map(([key, Icon, label]) => (
                        <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[8px] uppercase tracking-[.07em] transition-colors ${view === key ? "bg-cyan-200/[0.13] text-cyan-100" : "text-slate-500 hover:text-slate-200"}`}>
                          <Icon size={12} /><span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" title="Fit visualization" className="hidden rounded-md border border-white/[0.08] p-2 text-slate-500 hover:text-slate-200 md:block"><Maximize2 size={13} /></button>
                  </div>
                </div>
                <div className="relative h-[390px] overflow-hidden sm:h-[430px] xl:h-[min(52vh,570px)] xl:min-h-[470px]">
                  <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(104,181,195,.32) 1px, transparent 1px),linear-gradient(90deg,rgba(104,181,195,.32) 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
                  <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 51% 50%, rgba(15,68,78,.25), transparent 55%)" }} />
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#080d14]/75 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[.11em] text-slate-400 backdrop-blur-sm">
                    <Compass size={11} className="text-cyan-200/75" /> {view === "globe" ? "World view" : view === "map" ? "Public event field" : view === "network" ? "Sector relationships" : "Signal spectrum"}
                  </div>
                  <div className="absolute right-4 top-4 z-10 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.1em] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-cyan-300" />Sector focus</span>
                    <span className="text-white/15">/</span>
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-300" />Sample update</span>
                  </div>
                  {view === "globe" || view === "map" ? (
                    <GlobeScene selectedId={selectedId} onSelect={chooseSector} flat={view === "map"} />
                  ) : view === "network" ? (
                    <NetworkScene selectedId={selectedId} onSelect={chooseSector} />
                  ) : (
                    <SpectrumScene onSelect={() => chooseSector("spectrum")} />
                  )}
                  <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.12em] text-slate-500">
                    <Satellite size={12} className="text-slate-500" /> SAMPLE FIELD <span className="text-white/15">·</span> NOT LIVE
                  </div>
                  <div className="absolute bottom-4 right-4 z-10 font-mono text-[8px] uppercase tracking-[.12em] text-slate-600">SW / FIELD 01</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.075] px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-4 font-mono text-[8px] uppercase tracking-[.1em] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-cyan-300" />Selected sector</span>
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-300" />Sample update</span>
                  </div>
                  <span className="font-mono text-[8px] text-slate-600">Click a marker or sector to inspect</span>
                </div>
              </section>

              <aside className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.085] bg-[#0a1018]">
                <div className="flex items-center justify-between border-b border-white/[0.075] px-4 py-3.5">
                  <div className="font-mono text-[8px] uppercase tracking-[.16em] text-slate-500">Sector focus</div>
                  <span className="font-mono text-[8px] text-slate-600">{selected.index} / 09</span>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-cyan-200/[0.18] bg-cyan-200/[0.06] text-cyan-100">
                      <selected.icon size={17} strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-medium leading-5 tracking-[-.025em] text-slate-100">{selected.title}</h2>
                      </div>
                      <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[.1em] ${selected.status === "linked" ? "border-cyan-200/20 bg-cyan-200/[0.055] text-cyan-100/80" : "border-white/[0.09] bg-white/[0.025] text-slate-400"}`}>
                        <span className={`size-1 rounded-full ${selected.status === "linked" ? "bg-cyan-300" : "bg-slate-500"}`} />{selected.status === "linked" ? "Catalogue linked" : "UI preview"}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] leading-[1.65] text-slate-400">{selected.description}</p>
                </div>

                <div className="mx-4 rounded-lg border border-white/[0.075] bg-black/[0.16] sm:mx-5">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
                    <span className="font-mono text-[8px] uppercase tracking-[.13em] text-slate-500">Illustrative record</span>
                    <span className="rounded border border-amber-200/15 bg-amber-200/[0.04] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[.08em] text-amber-100/65">Sample only</span>
                  </div>
                  <dl className="divide-y divide-white/[0.055] px-3">
                    <RecordRow label="Reference" value={selected.sample} />
                    <RecordRow label="Source type" value={selected.status === "linked" ? "Public provider metadata" : "Illustrative content"} />
                    <RecordRow label="Lookup" value={selected.status === "linked" ? "Catalogue only" : "Not connected"} />
                  </dl>
                </div>

                <div className="mx-4 mt-3 rounded-lg border border-amber-200/[0.12] bg-amber-200/[0.025] px-3 py-2.5 sm:mx-5">
                  <div className="font-mono text-[7px] uppercase tracking-[.12em] text-amber-100/60">Operational boundary</div>
                  <p className="mt-1 text-[9px] leading-[1.6] text-slate-400">No search, scan, tracking or image analysis runs from this preview.</p>
                </div>

                <div className="mt-auto border-t border-white/[0.07] p-4 sm:p-5">
                  <button type="button" onClick={() => setView("map")} className="flex w-full items-center justify-between rounded-lg border border-cyan-200/[0.17] bg-cyan-200/[0.055] px-3 py-2.5 text-left text-[9px] font-medium text-cyan-100/90 transition-colors hover:bg-cyan-200/[0.1]">
                    <span className="flex items-center gap-2"><Map size={13} />Open public event map</span><ArrowUpRight size={13} />
                  </button>
                  <p className="mt-2.5 flex items-start gap-1.5 text-[8px] leading-4 text-slate-600"><ShieldCheck size={11} className="mt-0.5 shrink-0" />Sources stay attributed; unsupported coverage is never implied.</p>
                </div>
              </aside>
            </div>

            <section className="mt-3 overflow-hidden rounded-xl border border-white/[0.085] bg-[#0a1018]" aria-label="Sample update stream">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <Activity size={13} className="text-amber-200/80" />
                  <h2 className="font-mono text-[8px] uppercase tracking-[.15em] text-slate-300">Global update stream</h2>
                  <span className="rounded-full border border-amber-200/[0.14] bg-amber-200/[0.04] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[.09em] text-amber-100/65">Simulated</span>
                  <span className="hidden text-[9px] text-slate-600 sm:inline">Replay sample updates across sectors · not a live feed</span>
                </div>
                <button type="button" onClick={() => setReplaying((current) => !current)} aria-pressed={replaying} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[8px] font-medium transition-colors ${replaying ? "border-amber-200/20 bg-amber-200/[0.06] text-amber-100" : "border-white/[0.1] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}>
                  {replaying ? <Pause size={11} /> : <Play size={11} />}{replaying ? "Pause replay" : "Replay samples"}
                </button>
              </div>
              <div className="grid divide-y divide-white/[0.055] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 2xl:grid-cols-6">
                {updates.map((update, index) => {
                  const active = index === activeUpdate;
                  return (
                    <button type="button" key={update.id} onClick={() => { setActiveUpdate(index); setSelectedId(update.sector); }} aria-pressed={active} className={`group flex min-w-0 items-start gap-2.5 border-r border-white/[0.055] px-3.5 py-3 text-left transition-colors last:border-r-0 ${active ? "bg-cyan-200/[0.035]" : "hover:bg-white/[0.025]"}`}>
                      <span className={`mt-0.5 font-mono text-[7px] ${active ? "text-amber-100/75" : "text-slate-600"}`}>{update.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-mono text-[7px] uppercase tracking-[.07em] text-slate-600"><span className="truncate">{update.place}</span><span className="shrink-0">{update.time}</span></span>
                        <span className={`mt-1.5 block truncate text-[9px] font-medium ${active ? "text-slate-200" : "text-slate-400"}`}>{update.title}</span>
                        <span className="mt-1 block truncate text-[8px] text-slate-600">{update.note}</span>
                      </span>
                      <span className={`mt-1 size-1.5 shrink-0 rounded-full ${active ? "bg-amber-200" : "bg-slate-700"}`} />
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="mt-3 flex items-center justify-between gap-4 font-mono text-[7px] uppercase tracking-[.09em] text-slate-600">
              <span>Prototype environment <span className="px-1 text-slate-700">/</span> Sector field and replay are illustrative</span>
              <span className="hidden items-center gap-1.5 sm:flex"><Clock3 size={10} /> Workspace snapshot · 09:42 UTC</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeaderStat({ value, label }: { value: string; label: string }) {
  return <div><div className="font-mono text-[16px] leading-4 tracking-[-.04em] text-cyan-100/85">{value}</div><div className="mt-1.5 font-mono text-[7px] uppercase tracking-[.1em] text-slate-600">{label}</div></div>;
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 py-2.5"><dt className="text-[8px] text-slate-600">{label}</dt><dd className="max-w-[68%] text-right text-[8px] leading-4 text-slate-300/80">{value}</dd></div>;
}

function GlobeScene({ selectedId, onSelect, flat }: { selectedId: SectorId; onSelect: (id: SectorId) => void; flat: boolean }) {
  if (flat) {
    return (
      <svg viewBox="0 0 800 500" className="absolute inset-0 m-auto h-full max-h-[440px] w-full max-w-[920px]" role="group" aria-label="Illustrative world map with selectable sectors">
        <defs><linearGradient id="field-map-land" x1="0" x2="1"><stop stopColor="#16313a" /><stop offset="1" stopColor="#13242e" /></linearGradient></defs>
        {[130, 205, 280, 355].map((y) => <line key={y} x1="70" y1={y} x2="730" y2={y} stroke="#88c9d0" strokeOpacity=".09" strokeDasharray="3 8" />)}
        {[180, 320, 460, 600].map((x) => <line key={x} x1={x} y1="70" x2={x} y2="420" stroke="#88c9d0" strokeOpacity=".08" strokeDasharray="3 8" />)}
        <path d="M121 143 153 108 203 94 238 111 257 140 244 163 220 172 209 197 176 205 162 230 137 222 120 192 100 179Z M219 236 246 242 261 273 251 306 239 337 225 366 207 346 210 312 197 284Z M355 125 387 108 421 112 449 129 473 132 496 154 530 164 544 188 526 205 497 197 481 215 450 212 428 228 401 213 380 187 357 175Z M389 232 419 221 444 235 451 260 436 288 426 319 404 326 391 301 377 275Z M541 295 575 287 604 300 611 325 588 337 557 326Z" fill="url(#field-map-land)" stroke="#5ba5ae" strokeOpacity=".27" strokeWidth="1" />
        {locations.map((location) => {
          const sector = sectors.find((item) => item.id === location.id);
          const active = selectedId === location.id;
          const x = 75 + (location.x - 205) * 1.12;
          const y = 100 + (location.y - 120) * 1.05;
          return <g key={location.id} role="button" tabIndex={0} aria-label={`Select ${sector?.label}`} aria-pressed={active} onClick={() => onSelect(location.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(location.id); }} className="cursor-pointer outline-none">
            {active && <circle cx={x} cy={y} r="12" fill="none" stroke="#8ce6ec" strokeOpacity=".55" />}
            <circle cx={x} cy={y} r={active ? 4.6 : 3} fill={active ? "#f1d48a" : "#70d9e1"} stroke="#ddffff" strokeWidth=".8" />
            {active && <text x={x + 9} y={y - 9} fill="#d8f8f6" fontSize="9" letterSpacing="1" fontFamily="monospace">{sector?.label.toUpperCase()}</text>}
          </g>;
        })}
        <text x="400" y="444" textAnchor="middle" fill="#617780" fontSize="8" letterSpacing="2" fontFamily="monospace">EVENT FIELD · SOURCE COORDINATES</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 800 500" className="absolute inset-0 m-auto h-full max-h-[500px] w-full max-w-[1000px] select-none" role="group" aria-label="Illustrative globe with selectable intelligence sector markers">
      <defs>
        <radialGradient id="field-ocean" cx="39%" cy="32%" r="72%"><stop stopColor="#183740" /><stop offset=".56" stopColor="#10232d" /><stop offset="1" stopColor="#09131c" /></radialGradient>
        <radialGradient id="field-atmosphere"><stop offset=".73" stopColor="#6ce1e9" stopOpacity="0" /><stop offset=".9" stopColor="#62e2ea" stopOpacity=".09" /><stop offset="1" stopColor="#62e2ea" stopOpacity="0" /></radialGradient>
        <linearGradient id="field-continent" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#284851" /><stop offset="1" stopColor="#1a3038" /></linearGradient>
        <clipPath id="field-earth-clip"><circle cx="400" cy="249" r="176" /></clipPath>
      </defs>
      <circle cx="400" cy="249" r="203" fill="url(#field-atmosphere)" />
      <ellipse cx="400" cy="249" rx="290" ry="100" transform="rotate(-17 400 249)" fill="none" stroke="#51c4d0" strokeOpacity=".24" strokeWidth="1" />
      <ellipse cx="400" cy="249" rx="315" ry="128" transform="rotate(19 400 249)" fill="none" stroke="#c2a96b" strokeOpacity=".2" strokeWidth=".8" strokeDasharray="2 7" />
      <circle cx="400" cy="249" r="180" fill="url(#field-atmosphere)" />
      <circle cx="400" cy="249" r="176" fill="url(#field-ocean)" stroke="#72d5dd" strokeOpacity=".52" strokeWidth="1.2" />
      <g clipPath="url(#field-earth-clip)">
        {[-135, -90, -45, 0, 45, 90, 135].map((x) => <ellipse key={x} cx="400" cy="249" rx={Math.sqrt(Math.max(0, 176 * 176 - x * x))} ry="176" fill="none" stroke="#70c9d1" strokeOpacity={x === 0 ? ".18" : ".1"} strokeWidth=".8" />)}
        {[-135, -90, -45, 0, 45, 90, 135].map((y) => <ellipse key={y} cx="400" cy="249" rx="176" ry={Math.sqrt(Math.max(0, 176 * 176 - y * y))} fill="none" stroke="#70c9d1" strokeOpacity={y === 0 ? ".2" : ".11"} strokeWidth=".8" />)}
        <path d="M235 147 258 120 293 106 325 116 344 134 338 153 321 161 314 177 296 185 291 206 270 214 258 203 245 182 229 172Z M306 220 330 225 344 247 339 276 327 302 316 329 299 317 296 286 286 265 289 244Z M389 119 414 108 445 112 469 126 496 127 515 144 539 155 552 178 539 195 513 190 500 208 477 208 465 225 439 218 423 199 402 186 388 165Z M422 225 446 216 467 225 477 247 467 272 455 300 437 313 422 291 413 268 409 246Z M528 284 553 278 581 289 590 308 575 321 551 315 534 301Z M347 113 363 102 378 109 375 126 359 132Z" fill="url(#field-continent)" stroke="#77bdc4" strokeOpacity=".34" strokeWidth="1" />
        <path d="M236 147 258 120 293 106 325 116 344 134 338 153 321 161 314 177 296 185 291 206 270 214 258 203 245 182 229 172ZM389 119 414 108 445 112 469 126 496 127 515 144 539 155 552 178 539 195 513 190 500 208 477 208" fill="none" stroke="#8bd1d5" strokeOpacity=".18" strokeWidth=".75" />
        <path d="M250 182c54-26 97-32 138-12s81 24 143-13" fill="none" stroke="#82d5dc" strokeOpacity=".24" strokeWidth="1" />
        <path d="M281 280c38-31 76-46 119-40s79 17 129-16" fill="none" stroke="#d3b675" strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 5" />
      </g>
      <path d="M208 238 C282 111 504 81 604 236" fill="none" stroke="#80dae0" strokeOpacity=".31" strokeWidth="1" />
      {locations.map((location) => {
        const sector = sectors.find((item) => item.id === location.id);
        const active = selectedId === location.id;
        return <g key={location.id} role="button" tabIndex={0} aria-label={`Focus ${sector?.label} sector marker`} aria-pressed={active} onClick={() => onSelect(location.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(location.id); }} className="cursor-pointer outline-none">
          {active && <circle cx={location.x} cy={location.y} r="12" fill="none" stroke="#83e5ea" strokeOpacity=".65" strokeWidth="1"><animate attributeName="r" values="8;14;8" dur="3s" repeatCount="indefinite" /></circle>}
          <circle cx={location.x} cy={location.y} r={active ? 4.4 : 2.8} fill={active ? "#f0d58e" : "#83e0e6"} stroke={active ? "#fff0bd" : "#d2fcff"} strokeWidth=".8" />
          {active && <text x={location.x + 10} y={location.y - 9} fill="#e0f8f6" fontSize="8" letterSpacing="1" fontFamily="monospace">{sector?.label.toUpperCase()}</text>}
        </g>;
      })}
      <g fontFamily="monospace" fontSize="7" letterSpacing="1.2" fill="#63818a">
        <text x="400" y="46" textAnchor="middle">62° N</text><text x="400" y="461" textAnchor="middle">62° S</text>
        <text x="80" y="254">180° W</text><text x="644" y="254">180° E</text>
      </g>
      <circle cx="400" cy="249" r="176" fill="none" stroke="#87e3e9" strokeOpacity=".15" strokeWidth="1" />
    </svg>
  );
}

function NetworkScene({ selectedId, onSelect }: { selectedId: SectorId; onSelect: (id: SectorId) => void }) {
  const points = [{ id: "cameras" as const, x: 236, y: 150 }, { id: "identity" as const, x: 337, y: 112 }, { id: "crypto" as const, x: 465, y: 133 }, { id: "network" as const, x: 557, y: 184 }, { id: "imagery" as const, x: 535, y: 320 }, { id: "spectrum" as const, x: 430, y: 366 }, { id: "movement" as const, x: 304, y: 332 }, { id: "fisherman" as const, x: 220, y: 270 }, { id: "catalogue" as const, x: 398, y: 220 }];
  return <svg viewBox="0 0 800 500" className="absolute inset-0 m-auto h-full max-h-[430px] w-full max-w-[920px]" role="group" aria-label="Illustrative sector network">
    <circle cx="400" cy="245" r="125" fill="none" stroke="#4fadb7" strokeOpacity=".09" />
    <circle cx="400" cy="245" r="80" fill="none" stroke="#4fadb7" strokeOpacity=".12" strokeDasharray="3 8" />
    <circle cx="400" cy="245" r="37" fill="#10272f" stroke="#64c8d0" strokeOpacity=".38" />
    <text x="400" y="242" fill="#d5e5e4" textAnchor="middle" fontSize="9" fontFamily="monospace" letterSpacing="1.2">GLOBAL</text>
    <text x="400" y="258" fill="#71898d" textAnchor="middle" fontSize="7" fontFamily="monospace" letterSpacing="1">FIELD 01</text>
    {points.map((point) => {
      const active = selectedId === point.id;
      const sector = sectors.find((item) => item.id === point.id);
      return <g key={point.id} role="button" tabIndex={0} aria-label={`Select ${sector?.label}`} aria-pressed={active} onClick={() => onSelect(point.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(point.id); }} className="cursor-pointer outline-none">
        <line x1="400" y1="245" x2={point.x} y2={point.y} stroke={active ? "#d8bd7a" : "#55b7c1"} strokeOpacity={active ? ".72" : ".22"} strokeWidth={active ? "1.2" : ".8"} />
        <circle cx={point.x} cy={point.y} r={active ? 6 : 3.5} fill={active ? "#eed48e" : "#69cbd3"} stroke={active ? "#fff0bd" : "#ade9eb"} strokeWidth=".8" />
        <text x={point.x} y={point.y + 17} fill={active ? "#f0d996" : "#8aa2a7"} textAnchor="middle" fontSize="8" fontFamily="monospace" letterSpacing=".8">{sector?.label.toUpperCase()}</text>
      </g>;
    })}
  </svg>;
}

function SpectrumScene({ onSelect }: { onSelect: () => void }) {
  const bars = [38, 72, 49, 92, 64, 121, 54, 84, 44, 109, 61, 95, 47, 75, 112, 58, 88, 43];
  return <svg viewBox="0 0 800 500" className="absolute inset-0 m-auto h-full max-h-[430px] w-full max-w-[920px] cursor-pointer" role="button" tabIndex={0} aria-label="Select illustrative radio-frequency intelligence" onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}>
    {[130, 190, 250, 310, 370].map((y) => <line key={y} x1="95" y1={y} x2="705" y2={y} stroke="#9eb5c0" strokeOpacity=".1" strokeDasharray="3 7" />)}
    <path d="M96 342 C148 332 177 280 220 302 S271 348 316 265 S361 190 397 246 S453 328 492 246 S554 170 585 224 S641 277 704 202 L704 375 L96 375Z" fill="#59c3cc" fillOpacity=".07" />
    <path d="M96 342 C148 332 177 280 220 302 S271 348 316 265 S361 190 397 246 S453 328 492 246 S554 170 585 224 S641 277 704 202" fill="none" stroke="#72d3d9" strokeWidth="1.7" />
    {bars.map((height, index) => <rect key={index} x={112 + index * 32} y={375 - height} width="3" height={height} rx="1.5" fill={index === 8 ? "#e3c67c" : "#62c8d1"} fillOpacity={index === 8 ? ".9" : ".38"} />)}
    <text x="98" y="399" fill="#80999e" fontSize="8" fontFamily="monospace">300 MHz</text><text x="655" y="399" fill="#80999e" fontSize="8" fontFamily="monospace">900 MHz</text>
    <text x="400" y="435" fill="#cbb674" textAnchor="middle" fontSize="8" letterSpacing="1.8" fontFamily="monospace">SIMULATED SPECTRUM · NO RECEIVER CONNECTED</text>
  </svg>;
}