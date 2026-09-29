import "./_group.css";
import { useState } from "react";
import {
  InteractiveSectorGlobe,
  type GlobeMode,
} from "./InteractiveSectorGlobe";
import type { SectorId } from "@/lib/sectors";

export function Current() {
  const [selectedSectorId, setSelectedSectorId] =
    useState<SectorId>("imagery");
  const mode: GlobeMode = "globe";

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-[#05080e] p-5">
      <div className="w-full max-w-[1100px]">
        <InteractiveSectorGlobe
          mode={mode}
          selectedSectorId={selectedSectorId}
          activePulseIndex={2}
          onSelectSector={setSelectedSectorId}
        />
      </div>
    </main>
  );
}