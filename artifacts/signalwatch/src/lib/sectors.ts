import {
  Activity,
  BookOpen,
  Camera,
  Fingerprint,
  Image,
  Link2,
  Network,
  Radio,
  Wallet,
  type LucideIcon,
} from "lucide-react";

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

export type SectorPreviewRow = {
  label: string;
  value: string;
};

export type SectorDefinition = {
  id: SectorId;
  index: string;
  navLabel: string;
  title: string;
  icon: LucideIcon;
  description: string;
  detail: string;
  status: "connected" | "preview";
  accentClass: string;
  briefClaim?: string;
  queryLabel: string;
  queryExample: string;
  previewRows: SectorPreviewRow[];
  safetyNote: string;
};

export const sectors: SectorDefinition[] = [
  {
    id: "cameras",
    index: "01",
    navLabel: "Cameras",
    title: "Camera intelligence",
    icon: Camera,
    description: "Explore public camera locations on a global view.",
    detail:
      "Search public camera catalogues by location and provider. AI detection is shown as a concept only; no camera images are loaded here.",
    status: "connected",
    accentClass: "text-cyan-300",
    briefClaim: "250,000+ camera coverage claim",
    queryLabel: "Illustrative location search",
    queryExample: "Example: Brisbane, Queensland",
    previewRows: [
      { label: "Catalogue", value: "Public provider metadata" },
      { label: "AI detection", value: "Concept only · not connected" },
      { label: "Coverage", value: "Claim from brief · unverified" },
    ],
    safetyNote:
      "The current camera map opens provider sources directly and does not check or proxy snapshots.",
  },
  {
    id: "identity",
    index: "02",
    navLabel: "Identity",
    title: "Identity signals",
    icon: Fingerprint,
    description: "Correlate a username across permitted source types.",
    detail:
      "A concept for organizing public social profiles and properly authorized breach-notification or network datasets around a username.",
    status: "preview",
    accentClass: "text-violet-300",
    queryLabel: "Sample username",
    queryExample: "Example only · no lookup is performed",
    previewRows: [
      { label: "Source groups", value: "Public · licensed · authorized" },
      { label: "Sample alias", value: "signal.sample" },
      { label: "Lookup status", value: "Disabled in prototype" },
    ],
    safetyNote:
      "No username search or personal-record lookup is connected in this prototype.",
  },
  {
    id: "crypto",
    index: "03",
    navLabel: "Blockchain",
    title: "Blockchain tracing",
    icon: Wallet,
    description: "Follow wallet activity and on-chain relationships.",
    detail:
      "A visual workspace concept for inspecting public on-chain transactions and relationships across supported networks.",
    status: "preview",
    accentClass: "text-amber-300",
    briefClaim: "22+ blockchain coverage claim",
    queryLabel: "Sample wallet",
    queryExample: "0x… sample address · not queried",
    previewRows: [
      { label: "Network", value: "Ethereum · sample view" },
      { label: "Wallet", value: "0x7a…sample" },
      { label: "Flow graph", value: "Illustrative relationships" },
    ],
    safetyNote:
      "The wallet address and relationship view are illustrative, not fetched from a blockchain.",
  },
  {
    id: "network",
    index: "04",
    navLabel: "Network",
    title: "Network exposure",
    icon: Network,
    description: "Review ports and services on authorized assets.",
    detail:
      "A concept for documenting exposed services on networks you own or are explicitly authorized to assess.",
    status: "preview",
    accentClass: "text-emerald-300",
    queryLabel: "Reserved example host",
    queryExample: "example.org · no scan is performed",
    previewRows: [
      { label: "Asset", value: "example.org · reserved example" },
      { label: "Port", value: "443 · illustrative" },
      { label: "Assessment", value: "Preview only · no scan run" },
    ],
    safetyNote:
      "The scan controls are inactive. Live assessment would require an authorized target and a configured scanner.",
  },
  {
    id: "imagery",
    index: "05",
    navLabel: "Imagery",
    title: "Image geolocation",
    icon: Image,
    description: "Estimate a photo’s likely capture region from clues.",
    detail:
      "A review surface for comparing visible landmarks and metadata. Results are evidence to assess, not proof of a location.",
    status: "preview",
    accentClass: "text-rose-300",
    queryLabel: "Sample image",
    queryExample: "No image is uploaded or analyzed",
    previewRows: [
      { label: "Candidate region", value: "Wellington · sample" },
      { label: "Visual clue", value: "Coastline shape · illustrative" },
      { label: "Confidence", value: "74% · sample value" },
    ],
    safetyNote:
      "No image is uploaded or analyzed. The location clue and confidence are sample content.",
  },
  {
    id: "spectrum",
    index: "06",
    navLabel: "Spectrum",
    title: "Radio-frequency intelligence",
    icon: Radio,
    description: "Explore supported frequencies and modeled reception.",
    detail:
      "A concept for mapping permitted spectrum observations and understanding where a signal may be received.",
    status: "preview",
    accentClass: "text-sky-300",
    queryLabel: "Sample frequency",
    queryExample: "433.92 MHz · illustrative only",
    previewRows: [
      { label: "Frequency", value: "433.92 MHz · sample" },
      { label: "View", value: "Modeled reception area" },
      { label: "Receiver data", value: "Not connected" },
    ],
    safetyNote:
      "No receiver, transmitter, or frequency data source is connected.",
  },
  {
    id: "movement",
    index: "07",
    navLabel: "Movement",
    title: "Movement intelligence",
    icon: Activity,
    description: "Follow aggregate public movement signals by region.",
    detail:
      "A concept for displaying regional, aggregate movement indicators over time without person-level tracking.",
    status: "preview",
    accentClass: "text-orange-300",
    queryLabel: "Sample region",
    queryExample: "Global · aggregate sample",
    previewRows: [
      { label: "Area", value: "Central district · sample" },
      { label: "Measure", value: "Aggregate activity" },
      { label: "Time window", value: "15 min · illustrative" },
    ],
    safetyNote:
      "No live tracking is performed. The preview is aggregate and contains no individual movement records.",
  },
  {
    id: "fisherman",
    index: "08",
    navLabel: "Fisherman",
    title: "Fisherman link intelligence",
    icon: Link2,
    description: "Examine link relationships in a controlled workflow.",
    detail:
      "A concept for recording how a supplied link connects to related destinations, using controlled and authorized analysis.",
    status: "preview",
    accentClass: "text-fuchsia-300",
    queryLabel: "Reserved example link",
    queryExample: "https://example.org · no request is sent",
    previewRows: [
      { label: "Source", value: "example.org · reserved example" },
      { label: "Relationship", value: "3 sample hops" },
      { label: "Inspection", value: "Disabled in prototype" },
    ],
    safetyNote:
      "No URL is opened or inspected. All link relationships shown are illustrative.",
  },
  {
    id: "catalogue",
    index: "09",
    navLabel: "Catalogue",
    title: "Public-record catalogue",
    icon: BookOpen,
    description: "Search official public records from one workspace.",
    detail:
      "A concept for searching public records across official registries while retaining the record’s source and attribution.",
    status: "preview",
    accentClass: "text-yellow-200",
    briefClaim: "100+ official registry coverage claim",
    queryLabel: "Sample registry",
    queryExample: "Company records · sample only",
    previewRows: [
      { label: "Registry", value: "Registry 01 · sample" },
      { label: "Record type", value: "Public filing · illustrative" },
      { label: "Source link", value: "Not connected" },
    ],
    safetyNote:
      "No registry is queried. The claimed catalogue size needs verification before launch.",
  },
];

export type SampleUpdate = {
  id: string;
  sectorId: SectorId;
  region: string;
  title: string;
  detail: string;
};

export const sampleUpdates: SampleUpdate[] = [
  {
    id: "S-01",
    sectorId: "cameras",
    region: "BRISBANE · AU",
    title: "Camera catalogue marker added",
    detail: "Illustrative public-location update",
  },
  {
    id: "S-02",
    sectorId: "crypto",
    region: "ETHEREUM · SAMPLE",
    title: "Wallet relationship highlighted",
    detail: "Simulated on-chain path",
  },
  {
    id: "S-03",
    sectorId: "imagery",
    region: "WELLINGTON · SAMPLE",
    title: "Location clue added",
    detail: "Illustrative landmark match",
  },
  {
    id: "S-04",
    sectorId: "network",
    region: "EXAMPLE.ORG · RESERVED",
    title: "Service review staged",
    detail: "No network request or scan",
  },
  {
    id: "S-05",
    sectorId: "spectrum",
    region: "433.92 MHZ · SAMPLE",
    title: "Reception contour refreshed",
    detail: "Modeled preview, not receiver data",
  },
  {
    id: "S-06",
    sectorId: "catalogue",
    region: "REGISTRY 01 · SAMPLE",
    title: "Public record preview indexed",
    detail: "Illustrative catalogue entry",
  },
];