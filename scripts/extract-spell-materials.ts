/**
 * List unique spell material component strings from SRD + PHB catalogs.
 *
 * Usage:
 *   npx tsx scripts/extract-spell-materials.ts
 *   npx tsx scripts/extract-spell-materials.ts --consumed
 *   npx tsx scripts/extract-spell-materials.ts --costly
 */

import { SRD_SPELLS } from "../src/lib/dnd/phb/srd-spells.generated";
import { PHB_SPELLS } from "../src/lib/dnd/phb/spells";
import { extractMaterialComponentText } from "../src/lib/dnd/spell-glossary";

interface SpellRow {
  id: string;
  name: string;
  components: string;
}

function allSpells(): SpellRow[] {
  const bySlug = new Map<string, SpellRow>();
  for (const spell of SRD_SPELLS) {
    bySlug.set(spell.id, { id: spell.id, name: spell.name, components: spell.components });
  }
  for (const spell of PHB_SPELLS) {
    bySlug.set(spell.id, { id: spell.id, name: spell.name, components: spell.components });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isConsumed(text: string, components: string): boolean {
  return /\bconsumed\b/i.test(text) || /\bconsumed\b/i.test(components);
}

function isCostly(text: string): boolean {
  return /\bworth\b/i.test(text) || /\bcosts?\b/i.test(text) || /\d+\s*gp\b/i.test(text);
}

function main() {
  const consumedOnly = process.argv.includes("--consumed");
  const costlyOnly = process.argv.includes("--costly");

  const entries: Array<{ slug: string; name: string; material: string; consumed: boolean; costly: boolean }> = [];

  for (const spell of allSpells()) {
    const material = extractMaterialComponentText(spell.components);
    if (!material) continue;
    const consumed = isConsumed(material, spell.components);
    const costly = isCostly(material);
    if (consumedOnly && !consumed) continue;
    if (costlyOnly && !costly) continue;
    entries.push({
      slug: spell.id,
      name: spell.name,
      material,
      consumed,
      costly,
    });
  }

  const uniqueMaterials = [...new Set(entries.map((e) => e.material))].sort();

  process.stdout.write(`Spells with material text: ${entries.length}\n`);
  process.stdout.write(`Unique material strings: ${uniqueMaterials.length}\n\n`);

  if (process.argv.includes("--unique")) {
    for (const material of uniqueMaterials) {
      process.stdout.write(`- ${material}\n`);
    }
    return;
  }

  for (const entry of entries) {
    const flags = [
      entry.consumed ? "consumed" : null,
      entry.costly ? "costly" : null,
    ]
      .filter(Boolean)
      .join(", ");
    process.stdout.write(`${entry.slug} (${entry.name})${flags ? ` [${flags}]` : ""}\n`);
    process.stdout.write(`  ${entry.material}\n\n`);
  }
}

main();
