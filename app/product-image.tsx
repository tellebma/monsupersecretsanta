"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeProductImage } from "@/lib/format";
import { GiftIcon } from "./brand";

export function ProductImage({ src, productUrl, size, className = "" }: { src?: string; productUrl?: string; size?: number; className?: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const suppliedSource = safeProductImage(src)?.href;
  const [recovered, setRecovered] = useState<{ url: string; image?: string }>();
  const source = suppliedSource ?? (recovered?.url === productUrl ? recovered?.image : undefined);
  const [readySource, setReadySource] = useState<string>();
  const [failedSource, setFailedSource] = useState<string>();
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setReadySource(source);
  }, [source]);

  useEffect(() => {
    if (suppliedSource || !productUrl || !element.current) return;
    const request = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void fetch(`/api/gift-image?${new URLSearchParams({ url: productUrl })}`, { signal: request.signal }).then(async (response) => {
        if (!response.ok) return;
        const product = await response.json();
        if (!request.signal.aborted) setRecovered({ url: productUrl, image: safeProductImage(product.image)?.href });
      }).catch(() => {});
    }, { rootMargin: "200px" });
    observer.observe(element.current);
    return () => { request.abort(); observer.disconnect(); };
  }, [suppliedSource, productUrl]);

  return <span ref={element} className={`product-image ${className}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true">
    <GiftIcon size={24}/>
    {source && failedSource !== source && <img ref={imageRef} key={source} src={source} alt="" width={size ?? 48} height={size ?? 48}
      loading="lazy" decoding="async" referrerPolicy="no-referrer" data-ready={readySource === source}
      onLoad={() => setReadySource(source)} onError={() => setFailedSource(source)}/>}
  </span>;
}
