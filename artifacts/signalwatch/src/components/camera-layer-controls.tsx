import { Camera, Search } from "lucide-react";
import type {
  CameraCountry,
  CameraProviderSelection,
} from "@/hooks/use-camera-catalogue";

type CameraLayerControlsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  country: CameraCountry;
  onCountryChange: (country: CameraCountry) => void;
  provider: CameraProviderSelection;
  onProviderChange: (provider: CameraProviderSelection) => void;
  search: string;
  onSearchChange: (search: string) => void;
  matchedCount: number;
  returnedCount: number;
  isLoading: boolean;
  isFetching: boolean;
};

export function CameraLayerControls({
  enabled,
  onEnabledChange,
  country,
  onCountryChange,
  provider,
  onProviderChange,
  search,
  onSearchChange,
  matchedCount,
  returnedCount,
  isLoading,
  isFetching,
}: CameraLayerControlsProps) {
  const providers =
    country === "AU"
      ? [
          { value: "all", label: "All Australian providers" },
          { value: "qld-tmr", label: "Queensland TMR" },
          { value: "transport-for-nsw", label: "Transport for NSW" },
        ]
      : [
          { value: "all", label: "All US providers" },
          { value: "opentrafficcammap", label: "OpenTrafficCamMap USA" },
        ];

  return (
    <section
      className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center"
      aria-label="Public camera layer controls"
    >
      <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-xs font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          data-testid="toggle-camera-layer"
          className="size-3.5 accent-primary"
        />
        <Camera className="size-3.5 text-primary" />
        Public cameras
      </label>

      <div className="relative min-w-[170px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={!enabled}
          data-testid="input-search-cameras"
          aria-label="Search public cameras"
          placeholder="Search cameras or locations"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <label className="relative">
        <span className="sr-only">Filter camera country</span>
        <select
          value={country}
          onChange={(event) => onCountryChange(event.target.value as CameraCountry)}
          disabled={!enabled}
          data-testid="select-camera-country"
          className="h-9 appearance-none rounded-md border border-input bg-background py-0 pl-3 pr-8 text-xs outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="AU">Australia</option>
          <option value="US">United States</option>
        </select>
      </label>

      <label className="relative">
        <span className="sr-only">Filter camera provider</span>
        <select
          value={provider}
          onChange={(event) =>
            onProviderChange(event.target.value as CameraProviderSelection)
          }
          disabled={!enabled}
          data-testid="select-camera-provider"
          className="h-9 max-w-[220px] appearance-none rounded-md border border-input bg-background py-0 pl-3 pr-8 text-xs outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {providers.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div
        className="min-w-[128px] text-right font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:ml-auto"
        data-testid="status-camera-count"
        role="status"
      >
        {isLoading
          ? "Loading catalogue"
          : isFetching
            ? `${returnedCount.toLocaleString()} loaded · updating`
            : `${matchedCount.toLocaleString()} listed · ${returnedCount.toLocaleString()} shown`}
      </div>
    </section>
  );
}