import { unstable_cache } from "next/cache";
import {
  BUILTIN_HEX_LAYOUTS,
  type BuiltinHexLayoutId,
} from "@/lib/maps/layouts/registry";
import { parseChultSourceHtml } from "@/lib/maps/layouts/parse-chult-source";
import type { HexLayout } from "@/lib/maps/layouts/types";

async function fetchBuiltinLayout(layoutId: BuiltinHexLayoutId): Promise<HexLayout> {
  const source = BUILTIN_HEX_LAYOUTS[layoutId];
  const response = await fetch(source.sourceUrl, {
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${layoutId} hex layout (${response.status})`);
  }

  const html = await response.text();

  if (layoutId === "chult") {
    return parseChultSourceHtml(html);
  }

  throw new Error(`Unsupported hex layout: ${layoutId}`);
}

export function getBuiltinHexLayout(layoutId: BuiltinHexLayoutId): Promise<HexLayout> {
  return unstable_cache(
    () => fetchBuiltinLayout(layoutId),
    [`builtin-hex-layout-${layoutId}-v2`],
    { revalidate: 60 * 60 * 24 * 7 }
  )();
}
