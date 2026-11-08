/**
 * Sahid Freight brand mark: the original "S" route on a navy tile with mint
 * waypoints (public/brand/mark.svg), drawn inline so it follows the layout.
 */
export function Mark({ size = 28, glow = false, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden
      className={className}
      style={glow ? { filter: "drop-shadow(0 6px 18px rgba(61,123,255,0.45))" } : undefined}
    >
      <rect width="512" height="512" rx="112" fill="#0A1F44" />
      <g transform="translate(92.69,79.62) scale(3.2662)">
        <path d="M70 6 Q14 6 14 33 Q14 58 50 58 Q86 58 86 82 Q86 104 30 104" fill="none" stroke="#3D7BFF" strokeWidth="13.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="30" cy="104" r="7.88" fill="#5BE3C4" />
        <circle cx="70" cy="6" r="7.58" fill="#0A1F44" stroke="#5BE3C4" strokeWidth="4.24" />
      </g>
    </svg>
  );
}

export function Logo({ size = 28, light = false, withText = true, glow = false }: { size?: number; light?: boolean; withText?: boolean; glow?: boolean }) {
  const text = light ? "#F8FAFC" : "var(--text)";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Sahid Freight">
      <Mark size={size} glow={glow} />
      {withText && (
        <span className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: text }}>
          Sahid Freight
        </span>
      )}
    </span>
  );
}
