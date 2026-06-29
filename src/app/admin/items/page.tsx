import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllItems, upsertItem, deleteItem } from "@/lib/items/catalog";
import { ItemManager } from "./item-manager";
import type { Item } from "@/lib/schemas/item";

export const metadata = { title: "Item Catalog — DM Admin" };

async function getIsDm(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return false;
  const { data } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "dm")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export default async function AdminItemsPage() {
  const isDm = await getIsDm();
  if (!isDm) redirect("/");

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

  return (
    <>
      <h1 className="page-title">Item Catalog</h1>
      <ItemManager
        initialItems={items}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
}
