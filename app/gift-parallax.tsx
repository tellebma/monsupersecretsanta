"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function GiftParallax({ children }: { children: ReactNode }) {
  const illustration = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = illustration.current;
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;

    const update = () => {
      frame = null;

      const { top, bottom, height } = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (bottom <= 0 || top >= viewportHeight) return;

      const progress = (viewportHeight - top - bottom) / (viewportHeight + height);
      element.style.setProperty("--gift-parallax", progress.toFixed(3));
    };

    function schedule() {
      if (frame === null) frame = window.requestAnimationFrame(update);
    }

    function stop() {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    }

    const syncMotion = () => {
      if (reducedMotion.matches) {
        stop();
        element.style.removeProperty("--gift-parallax");
        return;
      }

      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      schedule();
    };

    reducedMotion.addEventListener("change", syncMotion);
    syncMotion();
    return () => {
      reducedMotion.removeEventListener("change", syncMotion);
      stop();
    };
  }, []);

  return <div ref={illustration} className="wrapping" aria-hidden="true">{children}</div>;
}
