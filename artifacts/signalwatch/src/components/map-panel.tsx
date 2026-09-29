import { Crosshair, MapPinned, Navigation, RadioTower } from 'lucide-react';
import type { BriefingEvent } from '@/lib/monitoring';
import { eventPoint } from '@/lib/monitoring';

export function SignalMap({ events, compact = false }: { events: BriefingEvent[]; compact?: boolean }) {
  const locatedEvents = events.filter((event) => event.latitude !== null && event.longitude !== null);
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-[#dfe4df] ${compact ? 'h-[260px]' : 'h-[500px]'}`} data-testid="map-signal-canvas">
      <div className="absolute inset-0 signal-grid opacity-50" />
      <div className="absolute inset-[9%_5%] rounded-[42%_55%_48%_52%] border border-[#b3c1ba]/80 bg-[#d3dcd5]/60 [clip-path:polygon(0_18%,12%_10%,18%_18%,31%_13%,38%_24%,47%_19%,54%_8%,69%_13%,75%_27%,91%_24%,100%_37%,92%_47%,95%_61%,79%_68%,72%_82%,58%_77%,49%_90%,36%_81%,23%_91%,14%_75%,3%_72%,9%_52%,0_42%)]" />
      <div className="absolute inset-x-0 top-1/2 border-t border-[#aab8b1]/60" />
      <div className="absolute inset-y-0 left-1/2 border-l border-[#aab8b1]/60" />
      <div className="absolute left-4 top-4 rounded-md border border-[#b7c2ba] bg-[#edf1ed]/85 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#5b6b63]">live event layer</div>
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-[#b7c2ba] bg-[#edf1ed]/85 px-2 py-1.5 text-[10px] text-[#53645c]">
        <Navigation className="size-3" /> coordinates from source
      </div>
      {locatedEvents.map((event) => {
        const point = eventPoint(event.latitude, event.longitude);
        if (!point) return null;
        return (
          <a
            key={event.id}
            href={event.url}
            target="_blank"
            rel="noreferrer"
            data-testid={`map-event-${event.id}`}
            title={`${event.title} — ${event.source}`}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={point}
          >
            <span className="absolute -inset-2 animate-ping rounded-full bg-[#d15842]/30" />
            <span className="relative block size-3 rounded-full border-2 border-[#f9f5eb] bg-[#bf4e3b] shadow-sm transition-transform group-hover:scale-150" />
          </a>
        );
      })}
      {locatedEvents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-[220px] text-center">
            <MapPinned className="mx-auto size-5 text-[#73827a]" />
            <p className="mt-2 text-xs font-medium text-[#53645c]">No geolocated events in the current briefing</p>
          </div>
        </div>
      )}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-[#b7c2ba] bg-[#edf1ed]/85 px-2 py-1 font-mono text-[9px] text-[#53645c]">
        <RadioTower className="size-3" /> {locatedEvents.length} plotted
      </div>
      {!compact && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-[#b7c2ba] bg-[#edf1ed]/85 px-2 py-1 font-mono text-[9px] text-[#53645c]">
          <Crosshair className="size-3" /> WGS84
        </div>
      )}
    </div>
  );
}