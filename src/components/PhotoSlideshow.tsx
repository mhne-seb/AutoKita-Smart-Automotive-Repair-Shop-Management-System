'use client'

import { useEffect, useState } from "react";

/**
 * Cross-fading slideshow of real shop photos with a slow Ken Burns zoom.
 * Swaps automatically; dots let visitors jump to a specific photo.
 */
export function PhotoSlideshow({
  images,
  className = "",
  intervalMs = 4500,
}: {
  images: string[];
  className?: string;
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-in-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={src}
            alt=""
            className={`h-full w-full object-cover ${i === active ? "animate-kenburns" : ""}`}
          />
        </div>
      ))}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
