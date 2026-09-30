import React from 'react';
/** Resolves registry `display.iconKey` values to icon components. */
import type { ComponentType } from 'react';
import {
  Building2,
  Camera,
  CircleAlert,
  Cloud,
  Layers,
  Newspaper,
  Satellite,
  Ship,
} from 'lucide-react';

export type LayerIcon = ComponentType<{ className?: string }>;

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3 21 7.2-7.2M14.8 5.2 19 1l1 1-4.2 4.2m-1.9 1.9 5.7 5.7-2.1 2.1-6.8-4.7-4.1 4.1-2.1-.7.7-2.1 4.1-4.1-4.7-6.8L6 3.9l5.7 5.7 4.1-4.1"
      />
    </svg>
  );
}

const icons: Record<string, LayerIcon> = {
  camera: Camera,
  newspaper: Newspaper,
  aircraft: PlaneIcon,
  ship: Ship,
  satellite: Satellite,
  hazard: CircleAlert,
  cloud: Cloud,
  building: Building2,
};

export function layerIcon(iconKey: string): LayerIcon {
  return icons[iconKey] ?? Layers;
}
