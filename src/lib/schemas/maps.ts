import { z } from "zod";

export const MAP_MARKER_COLORS = [
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "yellow", label: "Yellow", value: "#eab308" },
  { id: "purple", label: "Purple", value: "#a855f7" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "pink", label: "Pink", value: "#ec4899" },
  { id: "cyan", label: "Cyan", value: "#06b6d4" },
] as const;

export const DEFAULT_PARTY_MARKER_COLOR = MAP_MARKER_COLORS[0].value;

export const MAP_TYPES = ["image", "hex-reveal"] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const campaignMapSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  mapType: z.enum(MAP_TYPES).default("image"),
  hexLayoutId: z.string().nullable().default(null),
  imagePath: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

export const mapMarkerSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  mapId: z.string(),
  label: z.string().default("Party"),
  color: z.string().default(DEFAULT_PARTY_MARKER_COLOR),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
});

export const mapsDataSchema = z.object({
  maps: z.array(campaignMapSchema).default([]),
  markers: z.array(mapMarkerSchema).default([]),
  revealedHexes: z.record(z.string(), z.array(z.number().int())).default({}),
});

export type CampaignMap = z.infer<typeof campaignMapSchema>;
export type MapMarker = z.infer<typeof mapMarkerSchema>;
export type MapsData = z.infer<typeof mapsDataSchema>;

export function parseMapsData(input: unknown): MapsData {
  return mapsDataSchema.parse(input ?? {});
}

export function sortCampaignMaps(maps: CampaignMap[]): CampaignMap[] {
  return [...maps].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getMarkersForMap(markers: MapMarker[], mapId: string): MapMarker[] {
  return markers.filter((marker) => marker.mapId === mapId);
}

export function getRevealedHexesForMap(mapsData: MapsData, mapId: string): number[] {
  return mapsData.revealedHexes[mapId] ?? [];
}

export function isHexRevealed(mapsData: MapsData, mapId: string, hexId: number): boolean {
  return getRevealedHexesForMap(mapsData, mapId).includes(hexId);
}

export function toggleRevealedHex(
  mapsData: MapsData,
  mapId: string,
  hexId: number
): MapsData {
  const current = getRevealedHexesForMap(mapsData, mapId);
  const next = current.includes(hexId)
    ? current.filter((id) => id !== hexId)
    : [...current, hexId].sort((a, b) => a - b);

  return {
    ...mapsData,
    revealedHexes: {
      ...mapsData.revealedHexes,
      [mapId]: next,
    },
  };
}

export function clearRevealedHexes(mapsData: MapsData, mapId: string): MapsData {
  const next = { ...mapsData.revealedHexes };
  delete next[mapId];
  return {
    ...mapsData,
    revealedHexes: next,
  };
}

export function newCampaignMap(
  name: string,
  sortOrder: number,
  overrides?: Partial<CampaignMap>
): CampaignMap {
  return campaignMapSchema.parse({ name, sortOrder, ...overrides });
}

export function newMapMarker(mapId: string, overrides?: Partial<MapMarker>): MapMarker {
  return mapMarkerSchema.parse({ mapId, ...overrides });
}

export function newDefaultPartyMarker(mapId: string): MapMarker {
  return newMapMarker(mapId, { label: "Party", color: DEFAULT_PARTY_MARKER_COLOR });
}

export function isHexRevealMap(map: CampaignMap): boolean {
  return map.mapType === "hex-reveal" && !!map.hexLayoutId;
}
