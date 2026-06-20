import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePortraitFile } from "@/lib/character/portrait-storage";

const BUCKET = "notable-portraits";

export function getNotablePortraitUrl(
  supabase: SupabaseClient,
  portraitPath: string | null | undefined
): string | null {
  if (!portraitPath) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(portraitPath);
  return data.publicUrl;
}

export async function uploadNotablePortrait(
  supabase: SupabaseClient,
  campaignId: string,
  notableId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validatePortraitFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${campaignId}/${notableId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function removeNotablePortrait(
  supabase: SupabaseClient,
  portraitPath: string | null | undefined
): Promise<string | null> {
  if (!portraitPath) return null;
  const { error } = await supabase.storage.from(BUCKET).remove([portraitPath]);
  return error?.message ?? null;
}

export function hasNotablePortrait(notable: {
  portraitPath?: string;
  portraitUrl?: string;
}): boolean {
  return !!(notable.portraitPath?.trim() || notable.portraitUrl?.trim());
}
