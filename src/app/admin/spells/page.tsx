import { createClient } from "@/lib/supabase/server";
import { SpellsManager } from "./spells-manager";

export default async function SpellsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spells")
    .select("slug, name, level, school, casting_time, range, components, duration, description, ritual, concentration, classes, source")
    .order("level")
    .order("name");

  const entries = (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    level: row.level as number,
    school: row.school as string,
    castingTime: row.casting_time as string,
    range: row.range as string,
    components: row.components as string,
    duration: row.duration as string,
    description: row.description as string,
    ritual: row.ritual as boolean,
    concentration: row.concentration as boolean,
    classes: (row.classes as string[]) ?? [],
    source: row.source as string,
  }));

  return (
    <div>
      <h2 className="page-title">Spells Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Cantrips and spells available during character creation. Level 0 = cantrip.
        Classes are the spell list IDs (e.g. bard, cleric, wizard).
      </p>
      <SpellsManager entries={entries} />
    </div>
  );
}
