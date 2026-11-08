/** Sahid Freight wordmark with a road-and-ledger mark on a brand-blue tile. */
export function Logo({ size = 28, light = false, withText = true }: { size?: number; light?: boolean; withText?: boolean }) {
  const text = light ? "#F8FAFC" : "var(--text)";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Sahid Freight">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="sf-tile" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B6CF0" />
            <stop offset="1" stopColor="#1C3FBF" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#sf-tile)" />
        <path d="M8 22.5 L16 9.5 L24 22.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 18.5 H20.5" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="16" cy="23" r="1.6" fill="#FFFFFF" />
      </svg>
      {withText && (
        <span className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: text }}>
          Sahid Freight
        </span>
      )}
    </span>
  );
}
