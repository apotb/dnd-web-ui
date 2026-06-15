import { NextResponse } from "next/server";
import { getBuiltinHexLayoutBackground } from "@/lib/maps/layouts/load-builtin-layout";
import { isBuiltinHexLayoutId } from "@/lib/maps/layouts/registry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ layoutId: string }> }
) {
  const { layoutId } = await context.params;

  if (!isBuiltinHexLayoutId(layoutId)) {
    return NextResponse.json({ error: "Unknown hex layout" }, { status: 404 });
  }

  try {
    const bytes = await getBuiltinHexLayoutBackground(layoutId);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load map background";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
