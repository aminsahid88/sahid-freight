"use client";

/* Static hero backdrop — used while the WebGL scene loads,
   and permanently for users who prefer-reduced-motion.  */
export default function HeroFallback({ label = "" }: { label?: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden>
      {/* Radial gradient — navy → deeper navy */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 65% 45%, rgba(61,123,255,0.28) 0%, rgba(19,49,107,0.55) 40%, #0A1F44 78%)",
        }}
      />
      {/* Star dots */}
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "radial-gradient(circle at 12% 22%, rgba(255,255,255,0.6) 0.5px, transparent 1.5px)," +
            "radial-gradient(circle at 82% 74%, rgba(255,255,255,0.5) 0.5px, transparent 1.5px)," +
            "radial-gradient(circle at 45% 15%, rgba(91,227,196,0.7) 0.7px, transparent 1.5px)," +
            "radial-gradient(circle at 26% 80%, rgba(255,255,255,0.5) 0.5px, transparent 1.5px)," +
            "radial-gradient(circle at 68% 30%, rgba(91,227,196,0.5) 0.7px, transparent 1.5px)," +
            "radial-gradient(circle at 90% 50%, rgba(255,255,255,0.4) 0.5px, transparent 1.5px)",
          backgroundSize: "100% 100%",
        }}
      />
      {/* Static suggested globe silhouette */}
      <svg
        viewBox="0 0 400 400"
        style={{
          position: "absolute",
          right: "5%",
          top: "50%",
          transform: "translateY(-50%)",
          width: "min(58vh, 560px)",
          height: "min(58vh, 560px)",
          opacity: 0.85,
        }}
      >
        <defs>
          <radialGradient id="hf-atmo" cx="50%" cy="50%" r="60%">
            <stop offset="60%" stopColor="rgba(61,123,255,0)" />
            <stop offset="88%" stopColor="rgba(61,123,255,0.35)" />
            <stop offset="100%" stopColor="rgba(61,123,255,0)" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="180" fill="url(#hf-atmo)" />
        <circle cx="200" cy="200" r="140" fill="#0A1F44" stroke="rgba(61,123,255,0.35)" strokeWidth="1" />
        {/* Latitude lines */}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const y = 200 + lat * 1.6;
          const w = Math.sqrt(140 * 140 - (y - 200) * (y - 200));
          if (!isFinite(w)) return null;
          return (
            <ellipse
              key={`lat-${lat}`}
              cx="200"
              cy={y}
              rx={w}
              ry={w * 0.15}
              fill="none"
              stroke="rgba(61,123,255,0.22)"
              strokeWidth="0.8"
            />
          );
        })}
        {/* Longitude lines */}
        {[-60, -30, 0, 30, 60].map((deg, i) => (
          <ellipse
            key={`lng-${i}`}
            cx="200"
            cy="200"
            rx={140 * Math.cos((deg * Math.PI) / 180)}
            ry="140"
            fill="none"
            stroke="rgba(61,123,255,0.22)"
            strokeWidth="0.8"
          />
        ))}
        {/* Static city dots on the visible face */}
        {[
          { x: 210, y: 205 }, { x: 240, y: 195 }, { x: 260, y: 178 },
          { x: 280, y: 200 }, { x: 285, y: 220 }, { x: 235, y: 260 },
        ].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="rgba(91,227,196,0.25)" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="#5BE3C4" />
          </g>
        ))}
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "1px",
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
