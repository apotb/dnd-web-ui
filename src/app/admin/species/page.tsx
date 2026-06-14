import { createClient } from "@/lib/supabase/server";
import { SpeciesManager } from "./species-manager";

export default async function SpeciesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("species").select("slug, name, source, data").order("name");

  const entries = (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    source: row.source as string,
    extra: row.data as Record<string, unknown>,
  }));

  return (
    <div>
      <h2 className="page-title">Species Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Races/species available in the character creator. The JSON data matches the{" "}
        <code>PhbRace</code> shape (id, name, size, speed, abilityBonus, traits, …).
      </p>
      <SpeciesManager entries={entries} />
    </div>
  );
}
