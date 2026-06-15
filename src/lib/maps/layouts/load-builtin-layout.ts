import { unstable_cache } from "next/cache";
import {
  BUILTIN_HEX_LAYOUTS,
  type BuiltinHexLayoutId,
} from "@/lib/maps/layouts/registry";
import {
  getChultBackgroundBytes,
  parseChultSourceHtml,
} from "@/lib/maps/layouts/parse-chult-source";
import type { HexLayout } from "@/lib/maps/layouts/types";

const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

type LayoutPayload = {
  meta: HexLayout;
  background: Buffer;
};

const runtimeCache = new Map<BuiltinHexLayoutId, LayoutPayload>();
const inflight = new Map<BuiltinHexLayoutId, Promise<LayoutPayload>>();

function stripEmbeddedImage(layout: HexLayout): HexLayout {
  return {
    ...layout,
    image: {
      width: layout.image.width,
      height: layout.image.height,
      transform: layout.image.transform ?? null,
      href: "",
    },
  };
}

async function fetchLayoutPayload(layoutId: BuiltinHexLayoutId): Promise<LayoutPayload> {
  const source = BUILTIN_HEX_LAYOUTS[layoutId];
  const response = await fetch(source.sourceUrl, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${layoutId} hex layout (${response.status})`);
  }

  const html = await response.text();

  if (layoutId === "chult") {
    const full = parseChultSourceHtml(html);
    return {
      meta: stripEmbeddedImage(full),
      background: getChultBackgroundBytes(full),
    };
  }

  throw new Error(`Unsupported hex layout: ${layoutId}`);
}

async function loadLayoutPayload(layoutId: BuiltinHexLayoutId): Promise<LayoutPayload> {
  const cached = runtimeCache.get(layoutId);
  if (cached) return cached;

  const pending = inflight.get(layoutId);
  if (pending) return pending;

  const promise = fetchLayoutPayload(layoutId).then((payload) => {
    runtimeCache.set(layoutId, payload);
    inflight.delete(layoutId);
    return payload;
  });

  inflight.set(layoutId, promise);
  return promise;
}

async function fetchBuiltinLayoutMeta(
  layoutId: BuiltinHexLayoutId
): Promise<HexLayout> {
  const payload = await loadLayoutPayload(layoutId);
  return payload.meta;
}

export function getBuiltinHexLayoutMeta(
  layoutId: BuiltinHexLayoutId
): Promise<HexLayout> {
  return unstable_cache(
    () => fetchBuiltinLayoutMeta(layoutId),
    [`builtin-hex-layout-meta-${layoutId}-v3`],
    { revalidate: REVALIDATE_SECONDS }
  )();
}

export async function getBuiltinHexLayoutBackground(
  layoutId: BuiltinHexLayoutId
): Promise<Buffer> {
  const payload = await loadLayoutPayload(layoutId);
  return payload.background;
}
