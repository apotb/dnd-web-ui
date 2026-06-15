import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "character-portraits";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 5 * 1024 * 1024;

export function getCharacterPortraitUrl(
  supabase: SupabaseClient,
  portraitPath: string | null | undefined
): string | null {
  if (!portraitPath) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(portraitPath);
  return data.publicUrl;
}

export function validatePortraitFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

export async function uploadCharacterPortrait(
  supabase: SupabaseClient,
  campaignId: string,
  characterId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validatePortraitFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${campaignId}/${characterId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function removeCharacterPortrait(
  supabase: SupabaseClient,
  portraitPath: string | null | undefined
): Promise<string | null> {
  if (!portraitPath) return null;
  const { error } = await supabase.storage.from(BUCKET).remove([portraitPath]);
  return error?.message ?? null;
}
