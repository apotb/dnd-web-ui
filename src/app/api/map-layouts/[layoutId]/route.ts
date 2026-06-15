import { NextResponse } from "next/server";
import { getBuiltinHexLayout } from "@/lib/maps/layouts/load-builtin-layout";
import { isBuiltinHexLayoutId } from "@/lib/maps/layouts/registry";
import type { HexLayout } from "@/lib/maps/layouts/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ layoutId: string }> }
) {
  const { layoutId } = await context.params;

  if (!isBuiltinHexLayoutId(layoutId)) {
    return NextResponse.json({ error: "Unknown hex layout" }, { status: 404 });
  }

  try {
    const layout = await getBuiltinHexLayout(layoutId);
    const clientLayout: HexLayout = {
      ...layout,
      image: {
        ...layout.image,
        href: `/api/map-layouts/${layoutId}/background`,
      },
    };
    return NextResponse.json(clientLayout);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load hex layout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
