import { createClient } from "@/lib/supabase/server";
import { fetchCatalogSpecies } from "@/lib/content/catalog";
import { SpeciesManager } from "./species-manager";

export default async function SpeciesPage() {
  const species = await fetchCatalogSpecies();

  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("species")
    .select("slug, source")
    .order("name");
  const sourceBySlug = new Map(
    (sources ?? []).map((row) => [row.slug as string, row.source as string])
  );

  const entries = species.map((row) => {
    const { id, name, ...rest } = row;
    return {
      slug: id,
      name,
      source: sourceBySlug.get(id) ?? "PHB",
      extra: rest as Record<string, unknown>,
    };
  });

  return (
    <div>
      <h2 className="page-title">Species Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Species available in the character creator. Built-in PHB slugs and mechanics are merged
        into saved rows automatically.
      </p>
      <SpeciesManager entries={entries} />
    </div>
  );
}
