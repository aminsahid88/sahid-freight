/** Sahid Freight wordmark with a restrained road-and-ledger mark. */
export function Logo({ size = 28, light = false, withText = true }: { size?: number; light?: boolean; withText?: boolean }) {
  const text = light ? "#F8FAFC" : "var(--text)";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Sahid Freight">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#0F172A" />
        <path d="M8 22.5 L16 9.5 L24 22.5" stroke="#2F6BFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 18.5 H20.5" stroke="#F8FAFC" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="16" cy="23" r="1.6" fill="#F8FAFC" />
      </svg>
      {withText && (
        <span className="text-[17px] font-extrabold tracking-tight" style={{ color: text }}>
          Sahid Freight
        </span>
      )}
    </span>
  );
}
