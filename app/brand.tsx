import Link from "next/link";

export function GiftIcon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12m0-12H8a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h4a2.5 2.5 0 1 0-2.4-3.2L12 8Z"/>
  </svg>;
}

export function Brand() {
  return <Link href="/" className="brand"><span className="brand-mark"><GiftIcon /></span><span>Mon Super<br/><b>Secret Santa</b></span></Link>;
}
