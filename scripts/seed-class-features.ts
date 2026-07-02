/**
 * Seed SRD class and subclass features (levels 1–20) from dnd5eapi.co.
 *
 * Usage:
 *   npx tsx scripts/seed-class-features.ts              # preview counts
 *   npx tsx scripts/seed-class-features.ts --write      # update phb/classes.ts
 *   npx tsx scripts/seed-class-features.ts --sql        # emit SQL for migration
 *
 * Requires network access to https://www.dnd5eapi.co
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PHB_CLASSES } from "../src/lib/dnd/phb/classes";
import { PHB_EXTRA_SUBCLASSES } from "../src/lib/dnd/phb/phb-extra-subclasses";
import type { CatalogFeatureEntry } from "../src/lib/dnd/catalog-feature-mechanics";
import type { PhbClass, PhbSubclass } from "../src/lib/dnd/phb/types";

const API_BASE = "https://www.dnd5eapi.co/api";
const API_2014 = "https://www.dnd5eapi.co/api/2014";

interface ApiListResult {
  count: number;
  results: Array<{ index: string; name: string; url: string }>;
}

interface ApiFeature {
  index: string;
  name: string;
  level: number;
  desc: string[];
  class?: { index: string; name: string };
  subclass?: { index: string; name: string };
}

interface ApiSubclass {
  index: string;
  name: string;
  subclass_flavor?: string;
  desc?: string[];
}

const SUBCLASS_PICK_INDICES = new Set([
  "primal-path",
  "arcane-tradition",
  "divine-domain",
  "martial-archetype",
  "sacred-oath",
  "ranger-archetype",
  "roguish-archetype",
  "monastic-tradition",
  "druid-circle",
  "sorcerous-origin",
  "otherworldly-patron",
  "bard-college",
  "eldritch-invocations",
]);

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function featureUrl(index: string): string {
  return `${API_2014}/features/${index}`;
}

function shouldSkipClassFeature(feature: ApiFeature): boolean {
  const index = feature.index.toLowerCase();
  const name = feature.name.toLowerCase();

  if (feature.subclass) return true;
  if (SUBCLASS_PICK_INDICES.has(index)) return true;
  if (index.includes("ability-score-improvement")) return true;
  if (name.includes("ability score improvement")) return true;
  if (index.startsWith("spellcasting-")) return true;
  if (name.startsWith("spellcasting")) return true;
  if (index.includes("proficiency")) return true;
  if (name.endsWith(" proficiency")) return true;
  if (index.includes("divine-domain-improvement")) return true;
  if (index.includes("arcane-tradition-improvement")) return true;
  if (index.includes("primal-path-improvement")) return true;
  if (index.includes("-improvement-")) return true;
  if (name === "path feature") return true;
  if (/fighting-style-/.test(index) && index !== "fighter-fighting-style") return true;
  if (index.startsWith("ranger-favored-enemy")) return true;
  if (index.startsWith("ranger-natural-explorer")) return true;
  return false;
}

function toCatalogEntry(
  feature: ApiFeature,
  minLevel: number,
  preserve?: CatalogFeatureEntry
): CatalogFeatureEntry {
  const entry: CatalogFeatureEntry = {
    name: feature.name,
    description: feature.desc.join("\n\n").trim(),
    slug: feature.index,
    minLevel,
  };
  if (preserve?.mechanics) {
    entry.mechanics = preserve.mechanics;
  }
  if (preserve?.slug?.trim()) {
    entry.slug = preserve.slug.trim();
  }
  if (preserve?.description && preserve.description.length > entry.description.length) {
    entry.description = preserve.description;
  }
  return entry;
}

function buildPreserveMaps(cls: PhbClass): {
  bySlug: Map<string, CatalogFeatureEntry>;
  byName: Map<string, CatalogFeatureEntry>;
} {
  const bySlug = new Map<string, CatalogFeatureEntry>();
  const byName = new Map<string, CatalogFeatureEntry>();

  const add = (entry: CatalogFeatureEntry) => {
    if (entry.slug?.trim()) bySlug.set(entry.slug.trim(), entry);
    byName.set(entry.name.toLowerCase(), entry);
  };

  cls.features.forEach(add);
  cls.subclasses.forEach((sub) => sub.features.forEach(add));
  return { bySlug, byName };
}

function findPreserve(
  feature: ApiFeature,
  maps: ReturnType<typeof buildPreserveMaps>
): CatalogFeatureEntry | undefined {
  return (
    maps.bySlug.get(feature.index) ??
    maps.byName.get(feature.name.toLowerCase()) ??
    [...maps.bySlug.values()].find((e) =>
      feature.index.startsWith(`${e.slug}-`) || feature.index.startsWith(`${e.slug ?? ""}`)
    )
  );
}

async function fetchFeatureDetail(index: string): Promise<ApiFeature> {
  return fetchJson<ApiFeature>(featureUrl(index));
}

async function fetchClassLevelFeatures(
  classIndex: string,
  level: number
): Promise<ApiFeature[]> {
  const list = await fetchJson<ApiListResult>(
    `${API_BASE}/classes/${classIndex}/levels/${level}/features`
  );
  const features: ApiFeature[] = [];
  for (const ref of list.results) {
    const detail = await fetchFeatureDetail(ref.index);
    if (!shouldSkipClassFeature(detail)) {
      features.push({ ...detail, level });
    }
  }
  return features;
}

async function fetchSubclassLevelFeatures(
  subclassIndex: string,
  level: number
): Promise<ApiFeature[]> {
  const list = await fetchJson<ApiListResult>(
    `${API_2014}/subclasses/${subclassIndex}/levels/${level}/features`
  );
  const features: ApiFeature[] = [];
  for (const ref of list.results) {
    const detail = await fetchFeatureDetail(ref.index);
    if (detail.index.includes("ability-score-improvement")) continue;
    features.push({ ...detail, level });
  }
  return features;
}

async function seedClass(cls: PhbClass): Promise<{
  features: CatalogFeatureEntry[];
  subclasses: PhbSubclass[];
}> {
  const preserveMaps = buildPreserveMaps(cls);
  const featureBySlug = new Map<string, CatalogFeatureEntry>();

  for (let level = 1; level <= 20; level++) {
    const levelFeatures = await fetchClassLevelFeatures(cls.id, level);
    for (const feature of levelFeatures) {
      const preserve = findPreserve(feature, preserveMaps);
      const entry = toCatalogEntry(feature, level, preserve);
      const key = feature.index;
      featureBySlug.set(key, entry);
    }
  }

  const classList = await fetchJson<ApiListResult>(
    `${API_BASE}/classes/${cls.id}/subclasses`
  );
  const subclasses: PhbSubclass[] = [];

  for (const subRef of classList.results) {
    const subDetail = await fetchJson<ApiSubclass>(
      `${API_2014}/subclasses/${subRef.index}`
    );
    const subFeatureBySlug = new Map<string, CatalogFeatureEntry>();

    for (let level = 1; level <= 20; level++) {
      const levelFeatures = await fetchSubclassLevelFeatures(subRef.index, level);
      for (const feature of levelFeatures) {
        const preserve = findPreserve(feature, preserveMaps);
        const entry = toCatalogEntry(feature, level, preserve);
        subFeatureBySlug.set(feature.index, entry);
      }
    }

    const flavor = subDetail.subclass_flavor?.trim();
    const intro = subDetail.desc?.join("\n\n").trim();
    const subclassFeatures = [...subFeatureBySlug.values()].sort(
      (a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1)
    );

    if (intro && subclassFeatures.length === 0) {
      subclassFeatures.push({
        name: subDetail.name,
        description: intro,
        slug: subRef.index,
        minLevel: cls.subclassLevel,
      });
    }

    subclasses.push({
      id: subRef.index,
      name:
        cls.id === "cleric"
          ? `${subDetail.name} Domain`
          : flavor
            ? `${flavor}: ${subDetail.name}`
            : subDetail.name,
      features: subclassFeatures,
    });
  }

  const srdIds = new Set(subclasses.map((s) => s.id));
  for (const preserved of PHB_EXTRA_SUBCLASSES[cls.id] ?? []) {
    if (!srdIds.has(preserved.id)) {
      subclasses.push(preserved);
    }
  }

  const features = [...featureBySlug.values()].sort(
    (a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1)
  );

  for (const preserved of cls.features) {
    const slug = preserved.slug?.trim();
    const already =
      (slug && features.some((f) => f.slug === slug)) ||
      features.some((f) => f.name.toLowerCase() === preserved.name.toLowerCase());
    if (!already) {
      features.push(preserved);
    }
  }
  features.sort((a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1));

  for (const feature of features) {
    if (feature.slug === "arcane-recovery") {
      feature.minLevel = 2;
    }
  }

  return { features, subclasses };
}

function serializeClasses(classes: PhbClass[]): string {
  const body = JSON.stringify(classes, null, 2);
  return `import type { PhbClass } from "./types";

export const PHB_CLASSES: PhbClass[] = ${body};

export function getClass(id: string): PhbClass | undefined {
  return PHB_CLASSES.find((c) => c.id === id);
}

export function classRequiresSubclassAtLevel1(classId: string): boolean {
  const cls = getClass(classId);
  return cls?.subclassLevel === 1;
}

export const FIGHTING_STYLES = [
  "Archery",
  "Defense",
  "Dueling",
  "Great Weapon Fighting",
  "Protection",
  "Two-Weapon Fighting",
];

export const FAVORED_ENEMIES = [
  "Aberrations",
  "Beasts",
  "Celestials",
  "Constructs",
  "Dragons",
  "Elementals",
  "Fey",
  "Fiends",
  "Giants",
  "Monstrosities",
  "Oozes",
  "Plants",
  "Undead",
  "Two humanoid species",
];

export const FAVORED_TERRAINS = [
  "Arctic",
  "Coast",
  "Desert",
  "Forest",
  "Grassland",
  "Mountain",
  "Swamp",
  "Underdark",
  "Urban",
];
`;
}

function emitSql(classes: PhbClass[]): string {
  const lines = [
    "-- SRD class features seeded from dnd5eapi.co",
    "",
  ];
  for (const cls of classes) {
    const data = {
      features: cls.features,
      subclasses: cls.subclasses,
      subclassLevel: cls.subclassLevel,
    };
    lines.push(
      `UPDATE public.classes SET data = data || '${escSql(JSON.stringify(data))}'::jsonb WHERE slug = '${escSql(cls.id)}';`
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const write = process.argv.includes("--write");
  const sql = process.argv.includes("--sql");
  const merged: PhbClass[] = [];

  for (const cls of PHB_CLASSES) {
    process.stderr.write(`Seeding ${cls.name}...\n`);
    const { features, subclasses } = await seedClass(cls);
    process.stderr.write(
      `  ${features.length} class features, ${subclasses.length} subclasses\n`
    );
    merged.push({
      ...cls,
      features,
      subclasses,
    });
  }

  if (sql) {
    const sqlPath = resolve(process.cwd(), "supabase/migrations/077_seed_srd_class_features.sql");
    writeFileSync(sqlPath, emitSql(merged), "utf8");
    process.stderr.write(`Wrote ${sqlPath}\n`);
  }

  if (write) {
    const outPath = resolve(process.cwd(), "src/lib/dnd/phb/classes.ts");
    writeFileSync(outPath, serializeClasses(merged), "utf8");
    process.stderr.write(`Wrote ${outPath}\n`);
  }

  if (!write && !sql) {
    for (const cls of merged) {
      console.log(
        `${cls.id}: ${cls.features.length} features, ${cls.subclasses.length} subclasses`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
