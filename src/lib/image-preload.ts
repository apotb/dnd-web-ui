const preloadedUrls = new Set<string>();

/** Warm the browser image cache for URLs used in hover tooltips and tokens. */
export function preloadImageUrl(url: string): void {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
}

export function preloadImageUrls(urls: Iterable<string>): void {
  for (const url of urls) {
    preloadImageUrl(url);
  }
}
