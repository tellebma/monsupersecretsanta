"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function GiftParallax({ children }: { children: ReactNode }) {
  const illustration = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = illustration.current;
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let pointerX = 0;
    let pointerY = 0;

    const update = () => {
      frame = null;

      const { top, bottom, height } = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (bottom <= 0 || top >= viewportHeight) return;

      const progress = (viewportHeight - top - bottom) / (viewportHeight + height);
      element.style.setProperty("--gift-parallax", progress.toFixed(3));
      element.style.setProperty("--gift-pointer-x", pointerX.toFixed(3));
      element.style.setProperty("--gift-pointer-y", pointerY.toFixed(3));
    };

    function schedule() {
      if (frame === null) frame = window.requestAnimationFrame(update);
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      pointerX = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1));
      schedule();
    }

    function stop() {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", move);
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    }

    const syncMotion = () => {
      if (reducedMotion.matches) {
        stop();
        element.style.removeProperty("--gift-parallax");
        element.style.removeProperty("--gift-pointer-x");
        element.style.removeProperty("--gift-pointer-y");
        return;
      }

      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      window.addEventListener("pointermove", move, { passive: true });
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
