import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "combat-content";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 15 * 1024 * 1024;

export function resolveCombatImageUrl(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;
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

export function validateSquareCombatImageFile(file: File): Promise<string | null> {
  const basic = validateCombatImageFile(file);
  if (basic) return Promise.resolve(basic);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (image.naturalWidth !== image.naturalHeight) {
        resolve("Background must be a square image (equal width and height).");
        return;
      }
      resolve(null);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Could not read the selected image.");
    };
    image.src = url;
  });
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

export async function uploadCombatBackground(
  supabase: SupabaseClient,
  campaignId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = await validateSquareCombatImageFile(file);
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

export async function removeCombatImage(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<string | null> {
  if (!imagePath) return null;
  const { error } = await supabase.storage.from(BUCKET).remove([imagePath]);
  return error?.message ?? null;
}
