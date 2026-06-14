import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllItems, upsertItem, deleteItem } from "@/lib/items/catalog";
import { ItemManager } from "../items/item-manager";
import { SpellsManager } from "../spells/spells-manager";
import { SpeciesManager } from "../species/species-manager";
import { ClassesManager } from "../classes/classes-manager";
import { BackgroundsManager } from "../backgrounds/backgrounds-manager";
import { FeatsManager } from "../feats/feats-manager";
import type { Item } from "@/lib/schemas/item";

const CATEGORIES = [
  { id: "items",       label: "Items" },
  { id: "spells",      label: "Spells" },
  { id: "species",     label: "Species" },
  { id: "classes",     label: "Classes" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "feats",       label: "Feats" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: rawCat } = await searchParams;
  const cat: Category = (CATEGORIES.find((c) => c.id === rawCat)?.id ?? "items");

  const supabase = await createClient();

  // Fetch only the active category's data
  let content: React.ReactNode;

  if (cat === "items") {
    const items = await getAllItems();

    async function handleSave(
      payload: Omit<Item, "id" | "created_at" | "updated_at"> & { id?: string }
    ): Promise<Item | null> {
      "use server";
      return upsertItem(payload);
    }
    async function handleDelete(id: string): Promise<boolean> {
      "use server";
      return deleteItem(id);
    }

    content = (
      <ItemManager initialItems={items} onSave={handleSave} onDelete={handleDelete} />
    );
  } else if (cat === "spells") {
    const { data } = await supabase
      .from("spells")
      .select("slug,name,level,school,casting_time,range,components,duration,description,ritual,concentration,classes,source")
      .order("level").order("name");
    const entries = (data ?? []).map((r) => ({
      slug: r.slug as string, name: r.name as string, level: r.level as number,
      school: r.school as string, castingTime: r.casting_time as string,
      range: r.range as string, components: r.components as string,
      duration: r.duration as string, description: r.description as string,
      ritual: r.ritual as boolean, concentration: r.concentration as boolean,
      classes: (r.classes as string[]) ?? [], source: r.source as string,
    }));
    content = <SpellsManager entries={entries} />;
  } else if (cat === "species") {
    const { data } = await supabase.from("species").select("slug,name,source,data").order("name");
    const entries = (data ?? []).map((r) => ({ slug: r.slug as string, name: r.name as string, source: r.source as string, extra: r.data as Record<string, unknown> }));
    content = <SpeciesManager entries={entries} />;
  } else if (cat === "classes") {
    const { data } = await supabase.from("classes").select("slug,name,source,hit_die,data").order("name");
    const entries = (data ?? []).map((r) => ({ slug: r.slug as string, name: r.name as string, source: r.source as string, extra: { ...(r.data as Record<string, unknown>), hitDie: r.hit_die } }));
    content = <ClassesManager entries={entries} />;
  } else if (cat === "backgrounds") {
    const { data } = await supabase.from("backgrounds").select("slug,name,source,data").order("name");
    const entries = (data ?? []).map((r) => ({ slug: r.slug as string, name: r.name as string, source: r.source as string, extra: r.data as Record<string, unknown> }));
    content = <BackgroundsManager entries={entries} />;
  } else {
    const { data } = await supabase.from("feats").select("slug,name,description,prerequisite,source,data").order("name");
    const entries = (data ?? []).map((r) => ({ slug: r.slug as string, name: r.name as string, description: r.description as string, prerequisite: (r.prerequisite as string | null) ?? "", source: r.source as string, extra: r.data as Record<string, unknown> }));
    content = <FeatsManager entries={entries} />;
  }

  return (
    <div>
      <h2 className="page-title">Database</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "12px 0" }}>
        {CATEGORIES.map(({ id, label }) => (
          <Link
            key={id}
            href={`/admin/database?cat=${id}`}
            className={`candy-btn${cat === id ? " candy-btn-active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}
