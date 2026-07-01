import { createClient } from "@/lib/supabase/server";
import { fetchCatalogClasses, fetchCatalogSpecies } from "@/lib/content/catalog";
import { ClassesManager } from "./classes-manager";

export default async function ClassesPage() {
  const classes = await fetchCatalogClasses();

  const entries = classes.map((row) => {
    const { id: _id, name, hitDie, ...rest } = row;
    return {
      slug: row.id,
      name,
      source: "PHB",
      extra: { ...rest, hitDie },
    };
  });

  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("classes")
    .select("slug, source")
    .order("name");
  const sourceBySlug = new Map(
    (sources ?? []).map((row) => [row.slug as string, row.source as string])
  );

  return (
    <div>
      <h2 className="page-title">Classes Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Classes available in the character creator. Built-in PHB mechanics (uses, HP pools, slugs)
        are merged into saved rows automatically.
      </p>
      <ClassesManager
        entries={entries.map((entry) => ({
          ...entry,
          source: sourceBySlug.get(entry.slug) ?? entry.source,
        }))}
      />
    </div>
  );
}
