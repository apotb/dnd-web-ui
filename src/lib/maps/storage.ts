import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "campaign-maps";

export function getCampaignMapImageUrl(
  supabase: SupabaseClient,
  imagePath: string | null
): string | null {
  if (!imagePath) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function uploadCampaignMapImage(
  supabase: SupabaseClient,
  campaignId: string,
  mapId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${campaignId}/${mapId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function removeCampaignMapImage(
  supabase: SupabaseClient,
  imagePath: string | null
): Promise<string | null> {
  if (!imagePath) return null;
  const { error } = await supabase.storage.from(BUCKET).remove([imagePath]);
  return error?.message ?? null;
}
