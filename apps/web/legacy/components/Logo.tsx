export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: 32, md: 48, lg: 64 };
  const h = sizes[size];
  const w = h * 3.2;

  return (
    <svg width={w} height={h} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Truck cargo body */}
      <rect x="55" y="18" width="75" height="28" rx="4" fill="#d49b32"/>
      {/* Truck cab */}
      <rect x="128" y="24" width="32" height="22" rx="4" fill="#f0c060"/>
      {/* Cab highlight */}
      <rect x="128" y="24" width="32" height="8" rx="4" fill="#f5d070"/>
      {/* Windshield */}
      <rect x="133" y="28" width="18" height="11" rx="2" fill="#0a0a0a"/>
      {/* Windshield glare */}
      <rect x="135" y="30" width="5" height="7" rx="1" fill="rgba(255,255,255,0.15)"/>
      {/* Wheels */}
      <circle cx="78" cy="50" r="8" fill="#1a1a1a"/>
      <circle cx="78" cy="50" r="4" fill="#d49b32"/>
      <circle cx="78" cy="50" r="1.5" fill="#1a1a1a"/>
      <circle cx="142" cy="50" r="8" fill="#1a1a1a"/>
      <circle cx="142" cy="50" r="4" fill="#d49b32"/>
      <circle cx="142" cy="50" r="1.5" fill="#1a1a1a"/>
      {/* Chain links on cargo body */}
      <rect x="68" y="28" width="12" height="7" rx="3.5" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
      <rect x="78" y="28" width="12" height="7" rx="3.5" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
      <rect x="88" y="28" width="12" height="7" rx="3.5" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
      <rect x="98" y="28" width="12" height="7" rx="3.5" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
      {/* LL lettermark */}
      <text x="4" y="46" fontFamily="Georgia, 'Times New Roman', serif" fontSize="36" fontWeight="700" fill="#d49b32" letterSpacing="-2">LL</text>
      {/* Underline accent */}
      <line x1="4" y1="51" x2="46" y2="51" stroke="#d49b32" strokeWidth="2"/>
      {/* Road dashes */}
      <line x1="55" y1="58" x2="165" y2="58" stroke="#333" strokeWidth="1.5" strokeDasharray="6 4"/>
    </svg>
  );
}
