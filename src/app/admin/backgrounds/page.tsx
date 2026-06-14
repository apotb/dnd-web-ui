import { createClient } from "@/lib/supabase/server";
import { BackgroundsManager } from "./backgrounds-manager";

export default async function BackgroundsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("backgrounds").select("slug, name, source, data").order("name");

  const entries = (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    source: row.source as string,
    extra: row.data as Record<string, unknown>,
  }));

  return (
    <div>
      <h2 className="page-title">Backgrounds Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Character backgrounds available in the creator. JSON data matches the{" "}
        <code>PhbBackground</code> shape (skillProficiencies, equipment, gold, feature, …).
      </p>
      <BackgroundsManager entries={entries} />
    </div>
  );
}
