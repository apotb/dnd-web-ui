"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyPortraitProps {
  src: string;
  alt?: string;
  imageClassName?: string;
  fallback: ReactNode;
}

export function LazyPortrait({
  src,
  alt = "",
  imageClassName,
  fallback,
}: LazyPortraitProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex items-center justify-center">
      {visible ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imageClassName}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
