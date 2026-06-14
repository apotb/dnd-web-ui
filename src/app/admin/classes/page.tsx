import { createClient } from "@/lib/supabase/server";
import { ClassesManager } from "./classes-manager";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("slug, name, source, hit_die, data").order("name");

  const entries = (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    source: row.source as string,
    extra: { ...(row.data as Record<string, unknown>), hitDie: row.hit_die },
  }));

  return (
    <div>
      <h2 className="page-title">Classes Catalog</h2>
      <p className="retro-note" style={{ marginTop: "12px" }}>
        Classes available in the character creator. JSON data matches the{" "}
        <code>PhbClass</code> shape (hitDie, savingThrows, spellcasting, subclasses, …).
      </p>
      <ClassesManager entries={entries} />
    </div>
  );
}
