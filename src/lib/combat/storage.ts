import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSavedEncounterData } from "@/lib/schemas/saved-encounter";

const BUCKET = "combat-content";
const SRD_MONSTER_IMAGE_BASE = "https://www.dnd5eapi.co/api/images/monsters";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 15 * 1024 * 1024;

export function srdMonsterPortraitUrl(slug: string): string {
  return `${SRD_MONSTER_IMAGE_BASE}/${slug}.png`;
}

export function resolveCombatImageUrl(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

export function validateCombatImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 15 MB or smaller.";
  }
  return null;
}

export async function uploadEnemyPortrait(
  supabase: SupabaseClient,
  enemySlug: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateCombatImageFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `enemies/${enemySlug}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function uploadMarkerPortrait(
  supabase: SupabaseClient,
  campaignId: string,
  markerId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateCombatImageFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `markers/${campaignId}/${markerId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function uploadCombatBackground(
  supabase: SupabaseClient,
  campaignId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateCombatImageFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `backgrounds/${campaignId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function copyCombatImage(
  supabase: SupabaseClient,
  fromPath: string,
  toPath: string
): Promise<{ path: string | null; error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET).copy(fromPath, toPath);
  if (error) {
    return { path: null, error: error.message };
  }
  return { path: toPath, error: null };
}

export async function isCombatImageReferenced(
  supabase: SupabaseClient,
  imagePath: string
): Promise<boolean> {
  const { data: backgroundRows, error: backgroundError } = await supabase
    .from("encounters")
    .select("id")
    .eq("background_path", imagePath)
    .limit(1);

  if (backgroundError) {
    throw new Error(backgroundError.message);
  }
  if (backgroundRows && backgroundRows.length > 0) {
    return true;
  }

  const { data: encounters, error } = await supabase
    .from("encounters")
    .select("data");

  if (error) {
    throw new Error(error.message);
  }

  for (const row of encounters ?? []) {
    const data = parseSavedEncounterData(row.data);
    if (data.markers.some((marker) => marker.portraitPath === imagePath)) {
      return true;
    }
  }

  return false;
}

export async function removeCombatImage(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<string | null> {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return null;
  }
  const { error } = await supabase.storage.from(BUCKET).remove([imagePath]);
  return error?.message ?? null;
}

export async function removeCombatImageIfUnreferenced(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<string | null> {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return null;
  }

  try {
    const referenced = await isCombatImageReferenced(supabase, imagePath);
    if (referenced) return null;
  } catch {
    return null;
  }

  return removeCombatImage(supabase, imagePath);
}
