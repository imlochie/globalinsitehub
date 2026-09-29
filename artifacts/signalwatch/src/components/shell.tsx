import { BarChart3, CircleDot, ExternalLink, Layers3, Map, Radio, Radar, Settings2, Waypoints } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useState, type ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Workspace', icon: Radar },
  { href: '/map', label: 'Event map', icon: Map },
  { href: '/sources', label: 'Sources', icon: Radio },
];

const liveShortcuts = [
  { name: 'BBC World Service', detail: 'Global radio', url: 'https://www.bbc.co.uk/worldserviceradio' },
  { name: 'DW News', detail: 'International video', url: 'https://www.dw.com/en/live-tv/s-100825' },
  { name: 'FRANCE 24', detail: 'Continuous news', url: 'https://www.france24.com/en/live' },
];

export function SignalShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <ShellBrand />
        <div className="flex-1 overflow-y-auto px-3 pb-5">
          <p className="mb-2 px-3 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/45">Monitor</p>
          <nav className="space-y-1" aria-label="Primary navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? location === '/' : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className="size-4" strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                  {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground/70" />}
                </Link>
              );
            })}
          </nav>

          <p className="mb-2 px-3 pt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/45">Quick listen</p>
          <div className="space-y-1.5">
            {liveShortcuts.map((shortcut) => (
              <a
                key={shortcut.name}
                href={shortcut.url}
                target="_blank"
                rel="noreferrer"
                data-testid={`link-shortcut-${shortcut.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}
                className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <span className="flex size-6 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/50 font-mono text-[9px] font-medium text-sidebar-foreground/75">
                  {shortcut.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{shortcut.name}</span>
                  <span className="block truncate font-mono text-[9px] text-sidebar-foreground/40">{shortcut.detail}</span>
                </span>
                <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
              </a>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CircleDot className="size-3.5 text-sidebar-primary" />
              Public feed policy
            </div>
            <p className="mt-2 text-[11px] leading-4 text-sidebar-foreground/48">
              Signalwatch shows what a source returned. Every item keeps its original attribution.
            </p>
          </div>
        </div>
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="flex items-center justify-between text-[10px] text-sidebar-foreground/40">
            <span className="font-mono uppercase tracking-[0.14em]">Signalwatch</span>
            <span>v0.1</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-toggle-navigation"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Toggle navigation"
            >
              <Layers3 className="size-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Waypoints className="size-4" /></span>
              <span className="font-semibold tracking-tight">Signalwatch</span>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
              <BarChart3 className="size-3.5" />
              <span>Public signal monitor</span>
              <span className="mx-1 text-border">/</span>
              <span className="font-mono text-[10px] uppercase tracking-wider">{location === '/' ? 'workspace' : location.slice(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
              polling public feeds
            </span>
            <button type="button" data-testid="button-settings" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Settings">
              <Settings2 className="size-4" />
            </button>
          </div>
        </header>
        {mobileOpen && (
          <div className="fixed inset-x-0 top-16 z-30 border-b border-border bg-sidebar px-4 py-4 text-sidebar-foreground shadow-lg lg:hidden">
            <nav className="space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-sidebar-accent">
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
        <main>{children}</main>
      </div>
    </div>
  );
}

function ShellBrand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
      <span className="relative flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Waypoints className="size-4.5" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-sidebar bg-emerald-400" />
      </span>
      <div>
        <div className="font-semibold tracking-tight">Signalwatch</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/40">public intelligence</div>
      </div>
    </div>
  );
}