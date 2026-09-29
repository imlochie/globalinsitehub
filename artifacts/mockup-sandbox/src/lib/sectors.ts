export type SectorId =
  | "cameras"
  | "identity"
  | "crypto"
  | "network"
  | "imagery"
  | "spectrum"
  | "movement"
  | "fisherman"
  | "catalogue";

export const sectors: { id: SectorId; title: string; navLabel: string }[] = [
  { id: "cameras", title: "Cameras", navLabel: "Cameras" },
  { id: "identity", title: "Identity", navLabel: "Identity" },
  { id: "crypto", title: "Blockchain", navLabel: "Blockchain" },
  { id: "network", title: "Network", navLabel: "Network" },
  { id: "imagery", title: "Imagery", navLabel: "Imagery" },
  { id: "spectrum", title: "Spectrum", navLabel: "Spectrum" },
  { id: "movement", title: "Movement", navLabel: "Movement" },
  { id: "fisherman", title: "Fisherman", navLabel: "Fisherman" },
  { id: "catalogue", title: "Catalogue", navLabel: "Catalogue" },
];

export const sampleUpdates: { sectorId: SectorId }[] = [
  { sectorId: "cameras" },
  { sectorId: "crypto" },
  { sectorId: "imagery" },
  { sectorId: "network" },
  { sectorId: "spectrum" },
  { sectorId: "catalogue" },
];