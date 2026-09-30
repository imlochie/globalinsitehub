export type BriefingHeadline = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  language: string;
  imageUrl?: string | null;
  summary?: string | null;
};

export type BriefingEvent = {
  id: string;
  title: string;
  category: string;
  source: string;
  /** Explicit feed provenance, set server-side where the record is created. */
  sourceKind: 'hazard' | 'news';
  url: string;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  detail?: string | null;
};

export type BriefingSource = {
  id: string;
  name: string;
  category: string;
  attribution: string;
  url: string;
  status: 'online' | 'unavailable' | 'configured' | 'provider-needed' | 'not-integrated';
  itemsReceived: number;
  checkedAt: string;
  message: string;
};

export type Briefing = {
  generatedAt: string;
  headlineCount: number;
  eventCount: number;
  sourcesOnline: number;
  headlines: BriefingHeadline[];
  events: BriefingEvent[];
  sources: BriefingSource[];
};

export const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'time unavailable';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(Math.max(0, diff) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const formatAbsoluteTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const displayLanguage = (language: string) =>
  language ? language.toUpperCase().slice(0, 8) : '—';

export const eventPoint = (latitude: number | null, longitude: number | null) => {
  if (latitude === null || longitude === null) return null;
  return {
    left: `${Math.max(3, Math.min(97, ((longitude + 180) / 360) * 100))}%`,
    top: `${Math.max(4, Math.min(96, ((90 - latitude) / 180) * 100))}%`,
  };
};

export const statusLabel = (status: BriefingSource['status'] | 'all') => {
  if (status === 'all') return 'all';
  if (status === 'online') return 'Online';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'provider-needed') return 'Provider needed';
  if (status === 'not-integrated') return 'Not integrated';
  return 'Configured';
};