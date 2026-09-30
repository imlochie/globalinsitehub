import { Globe, Radio, Settings2, Waypoints, WifiOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState, type ReactNode } from "react";
import { PwaInstallControl } from "@/components/pwa-install-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const reduceMotionStorageKey = "signalwatch:reduce-motion";

const navItems = [
  {
    href: "/sectors",
    label: "Intelligence sectors",
    shortLabel: "Sectors",
    icon: Globe,
  },
  { href: "/sources", label: "Sources", shortLabel: "Sources", icon: Radio },
];

export function SignalShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(readReduceMotionPreference);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const isIntelligenceArea =
    location === "/" || location === "/map" || location.startsWith("/sectors");
  const isSectorPreview = isIntelligenceArea;

  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) {
      root.dataset.reduceMotion = "true";
    } else {
      delete root.dataset.reduceMotion;
    }
    try {
      window.localStorage.setItem(reduceMotionStorageKey, String(reduceMotion));
    } catch {
      // The preference still applies for this session if storage is unavailable.
    }
  }, [reduceMotion]);

  useEffect(() => {
    const updateConnectionStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    return () => {
      window.removeEventListener("online", updateConnectionStatus);
      window.removeEventListener("offline", updateConnectionStatus);
    };
  }, []);

  return (
    <div
      className={`min-h-[100dvh] ${
        isSectorPreview
          ? "bg-[#070a10] text-slate-100"
          : "bg-background text-foreground"
      }`}
    >
      <header
        className={`sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-3 backdrop-blur-md sm:gap-3 sm:px-5 lg:px-8 ${
          isSectorPreview
            ? "border-white/10 bg-[#070a10]/90 text-slate-100"
            : "border-border bg-background/90"
        }`}
      >
        <Link
          href="/sectors"
          data-testid="link-shell-home"
          aria-label="Signalwatch intelligence sectors"
          className="flex shrink-0 items-center gap-2.5"
        >
          <span
            className={`flex size-8 items-center justify-center rounded-lg ${
              isSectorPreview
                ? "border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Waypoints className="size-4" />
          </span>
          <span
            className={`text-sm font-semibold tracking-tight ${
              isSectorPreview ? "text-slate-100" : "text-foreground"
            }`}
          >
            Signalwatch
          </span>
        </Link>

        <nav
          className={`flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl border p-1 ${
            isSectorPreview
              ? "border-white/10 bg-white/[0.025]"
              : "border-border bg-muted/50"
          }`}
          aria-label="Primary navigation"
        >
          {navItems.map(({ href, label, shortLabel, icon: Icon }) => {
            const active =
              href === "/sectors"
                ? isIntelligenceArea
                : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-xs ${
                  active
                    ? isSectorPreview
                      ? "bg-cyan-200/15 text-cyan-100 shadow-sm"
                      : "bg-background text-foreground shadow-sm"
                    : isSectorPreview
                      ? "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            className={`hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] xl:flex ${
              isSectorPreview ? "text-amber-200/75" : "text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isSectorPreview ? "bg-amber-300" : "animate-pulse bg-emerald-600"
              }`}
            />
            {isSectorPreview
              ? "sample sectors · sourced views"
              : "polling public feeds"}
          </span>
          <PwaInstallControl isSectorPreview={isSectorPreview} />
          <button
            type="button"
            data-testid="button-settings"
            className={`flex rounded-md p-2 transition-colors ${
              isSectorPreview
                ? "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      </header>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 border-b px-4 py-3 text-xs leading-5 sm:px-6 ${
            isSectorPreview
              ? "border-amber-200/15 bg-amber-300/10 text-amber-100"
              : "border-amber-300/30 bg-amber-50 text-amber-950"
          }`}
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Offline.</strong> The app shell is available, but live
            briefings and camera feeds are not refreshing. Any records still
            visible were loaded earlier in this session; provider responses are
            not cached for offline use.
          </p>
        </div>
      )}
      <main className="min-w-0">{children}</main>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className={
            isSectorPreview
              ? "border-white/10 bg-[#0d131d] text-slate-100"
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>Display settings</DialogTitle>
            <DialogDescription
              className={isSectorPreview ? "text-slate-400" : undefined}
            >
              Adjust motion effects across Signalwatch.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-6 rounded-lg border border-current/10 p-4">
            <div className="space-y-1">
              <Label htmlFor="reduce-motion">Reduce motion</Label>
              <p
                id="reduce-motion-description"
                className={`text-xs leading-5 ${
                  isSectorPreview ? "text-slate-400" : "text-muted-foreground"
                }`}
              >
                Minimize animations and turn off smooth scrolling.
              </p>
            </div>
            <Switch
              id="reduce-motion"
              checked={reduceMotion}
              onCheckedChange={setReduceMotion}
              aria-describedby="reduce-motion-description"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function readReduceMotionPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(reduceMotionStorageKey) === "true";
  } catch {
    return false;
  }
}