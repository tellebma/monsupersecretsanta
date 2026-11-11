"use client";

import { useCallback, useState } from "react";
import { safeProductImage } from "@/lib/format";
import { GiftIcon } from "./brand";

export function ProductImage({ src, size, className = "" }: { src?: string; size?: number; className?: string }) {
  const source = safeProductImage(src)?.href;
  const [readySource, setReadySource] = useState<string>();
  const [failedSource, setFailedSource] = useState<string>();
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setReadySource(source);
  }, [source]);

  return <span className={`product-image ${className}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true">
    <GiftIcon size={24}/>
    {source && failedSource !== source && <img ref={imageRef} key={source} src={source} alt="" width={size ?? 48} height={size ?? 48}
      loading="lazy" decoding="async" referrerPolicy="no-referrer" data-ready={readySource === source}
      onLoad={() => setReadySource(source)} onError={() => setFailedSource(source)}/>}
  </span>;
}
