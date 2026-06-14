import { createClient } from "@/lib/supabase/server";
import { FeatsManager } from "./feats-manager";

export default async function FeatsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feats")
    .select("slug, name, description, prerequisite, source, data")
    .order("name");

  const entries = (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    prerequisite: (row.prerequisite as string | null) ?? "",
    source: row.source as string,
    extra: row.data as Record<string, unknown>,
  }));

  return (
    <div>
      <h2 className="page-title">Feats Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Feats available to Variant Humans (and future feat mechanics). Seeding adds all PHB feats.
      </p>
      <FeatsManager entries={entries} />
    </div>
  );
}
