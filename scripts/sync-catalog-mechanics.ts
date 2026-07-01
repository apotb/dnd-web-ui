/**
 * One-time sync: write merged PHB mechanics/slugs into existing Supabase catalog rows.
 *
 * Usage:
 *   npx tsx scripts/sync-catalog-mechanics.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PHB_CLASSES } from "../src/lib/dnd/phb/classes";
import { ALL_SPECIES } from "../src/lib/dnd/phb/species";
import {
  mergeClassWithPhb,
  mergeSpeciesWithPhb,
} from "../src/lib/content/catalog-merge";
import type { PhbClass, PhbSpecies } from "../src/lib/dnd/phb/types";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  let updatedClasses = 0;
  let updatedSpecies = 0;

  const phbClassById = new Map(PHB_CLASSES.map((entry) => [entry.id, entry]));
  const phbSpeciesById = new Map(ALL_SPECIES.map((entry) => [entry.id, entry]));

  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("slug, name, hit_die, source, data");
  if (classError) throw classError;

  for (const row of classRows ?? []) {
    const slug = row.slug as string;
    const dbClass = {
      ...(row.data as PhbClass),
      id: slug,
      name: row.name as string,
      hitDie: row.hit_die as number,
    };
    const merged = mergeClassWithPhb(dbClass, phbClassById.get(slug));
    const { id: _id, name: _name, hitDie: _hitDie, ...data } = merged;
    const { error } = await supabase
      .from("classes")
      .update({ data })
      .eq("slug", slug);
    if (error) throw error;
    updatedClasses += 1;
  }

  const { data: speciesRows, error: speciesError } = await supabase
    .from("species")
    .select("slug, name, source, data");
  if (speciesError) throw speciesError;

  for (const row of speciesRows ?? []) {
    const slug = row.slug as string;
    const dbSpecies = {
      ...(row.data as PhbSpecies),
      id: slug,
      name: row.name as string,
    };
    const merged = mergeSpeciesWithPhb(dbSpecies, phbSpeciesById.get(slug));
    const { id: _id, name: _name, ...data } = merged;
    const { error } = await supabase
      .from("species")
      .update({ data })
      .eq("slug", slug);
    if (error) throw error;
    updatedSpecies += 1;
  }

  console.log(`Updated ${updatedClasses} classes and ${updatedSpecies} species.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
