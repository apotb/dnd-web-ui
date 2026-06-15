import { NextResponse } from "next/server";
import { getBuiltinHexLayout } from "@/lib/maps/layouts/load-builtin-layout";
import { getChultBackgroundBytes } from "@/lib/maps/layouts/parse-chult-source";
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
    const layout = await getBuiltinHexLayout(layoutId);

    if (layoutId === "chult") {
      const bytes = getChultBackgroundBytes(layout);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported background" }, { status: 404 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load map background";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
