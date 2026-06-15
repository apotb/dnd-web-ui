import type { HexLayout } from "@/lib/maps/layouts/types";

export function parseChultSourceHtml(html: string): HexLayout {
  const viewBoxMatch = html.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    throw new Error("Chult layout source is missing viewBox");
  }

  const imageTagMatch = html.match(/<image\s+width="([^"]+)"\s+height="([^"]+)"[^>]+>/);
  if (!imageTagMatch) {
    throw new Error("Chult layout source is missing background image");
  }

  const imageTag = imageTagMatch[0];
  const hrefMatch = imageTag.match(/xlink:href="(data:image\/[^"]+)"/);
  if (!hrefMatch) {
    throw new Error("Chult layout source is missing background image data");
  }

  const transformMatch = imageTag.match(/transform="([^"]+)"/);

  const polygons = [...html.matchAll(/<polygon class="st0" points="([^"]+)"\s*\/>/g)];
  if (polygons.length === 0) {
    throw new Error("Chult layout source is missing hex polygons");
  }

  const viewBox = viewBoxMatch[1].split(/\s+/).map(Number) as [
    number,
    number,
    number,
    number,
  ];

  return {
    id: "chult",
    name: "Chult",
    viewBox,
    image: {
      width: Number(imageTagMatch[1]),
      height: Number(imageTagMatch[2]),
      href: hrefMatch[1],
      transform: transformMatch?.[1] ?? null,
    },
    hexes: polygons.map((match, index) => ({
      id: index,
      points: match[1],
    })),
  };
}

export function getChultBackgroundBytes(layout: HexLayout): Buffer {
  const [, base64] = layout.image.href.split(",", 2);
  if (!base64) {
    throw new Error("Chult background image is invalid");
  }
  return Buffer.from(base64, "base64");
}
