"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const P = "var(--navy)";     // brand navy
const A = "var(--accent)";   // brand blue
const BG = "var(--bg)";      // off-white background
const SRF = "var(--surface)"; // surface white

export default function LandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ loads: "...", trucks: "...", countries: "3" });

  useEffect(() => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (user && token) router.push("/dashboard");

    // Fetch live stats
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://sahid-freight-production.up.railway.app"}/stats/public`)
      .then(r => r.json())
      .then(d => setStats({ loads: d.totalLoads ?? "...", trucks: d.totalTrucks ?? "...", countries: "3" }))
      .catch(() => setStats({ loads: "500+", trucks: "200+", countries: "3" }));
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", background: BG, color: "var(--text)", overflowX: "hidden", width: "100%" }}>

      {/* ── NAVBAR ──────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "rgba(10,31,68,0.97)", backdropFilter: "blur(12px)", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ height: "38px", width: "38px", objectFit: "contain", borderRadius: "8px" }} />
          <span style={{ fontSize: "20px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
        </div>
        <div className="nav-ctas" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => router.push("/auth/login")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.35)", borderRadius: "10px", padding: "9px 22px", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Login</button>
          <button onClick={() => router.push("/auth/register")} style={{ background: A, border: "none", borderRadius: "10px", padding: "9px 22px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Get Started →</button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", background: `linear-gradient(150deg, ${P} 0%, #13316B 55%, #0A1F44 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "130px 24px 80px", boxSizing: "border-box" }}>
        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: `radial-gradient(circle, ${A} 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
        {/* Glow blobs */}
        <div style={{ position: "absolute", top: "15%", right: "8%", width: "480px", height: "480px", background: `radial-gradient(circle, rgba(61,123,255,0.18) 0%, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "8%", left: "3%", width: "320px", height: "320px", background: `radial-gradient(circle, rgba(61,123,255,0.09) 0%, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />

        <div style={{ maxWidth: "860px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(61,123,255,0.15)", border: "1px solid rgba(61,123,255,0.35)", borderRadius: "99px", padding: "6px 18px", marginBottom: "36px" }}>
            <span style={{ width: "7px", height: "7px", background: "#5BE3C4", borderRadius: "50%", boxShadow: "0 0 6px #5BE3C4", display: "inline-block" }} />
            <span style={{ color: A, fontSize: "13px", fontWeight: "600" }}>Now live in Ethiopia, Somalia & Djibouti</span>
          </div>

          <h1 className="hero-h1" style={{ margin: "0 0 24px", fontSize: "clamp(40px, 7vw, 82px)", fontWeight: "800", color: "#fff", lineHeight: 1.05, letterSpacing: "-2.5px" }}>
            Move Cargo.<br />
            <span style={{ color: A }}>Connect East Africa.</span>
          </h1>

          <p style={{ margin: "0 0 52px", fontSize: "clamp(16px, 2.3vw, 20px)", color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: "580px", marginLeft: "auto", marginRight: "auto" }}>
            The fastest way to connect cargo senders with trusted truck owners across Ethiopia, Somalia, and Djibouti.
          </p>

          <div className="hero-btns" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginBottom: "72px" }}>
            <button onClick={() => router.push("/auth/register")} style={{ background: A, border: "none", borderRadius: "12px", padding: "16px 40px", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: `0 8px 32px rgba(61,123,255,0.45)` }}
              onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
              Start Shipping →
            </button>
            <button onClick={() => router.push("/auth/register")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", padding: "16px 40px", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}
              onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
              Register Your Truck
            </button>
          </div>

          <div className="hero-stats" style={{ display: "flex", gap: "56px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { value: stats.loads, label: "Loads Posted" },
              { value: stats.trucks, label: "Trucks Registered" },
              { value: stats.countries, label: "Countries" },
              { value: "24h", label: "Verification" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "34px", fontWeight: "800", color: A, letterSpacing: "-1px" }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: "500", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", background: `rgba(10,31,68,0.07)`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: "700", color: P, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>How It Works</div>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: P, letterSpacing: "-1px" }}>Simple, Fast, Reliable</h2>
            <p style={{ margin: 0, fontSize: "17px", color: "var(--text-secondary)", maxWidth: "460px", marginLeft: "auto", marginRight: "auto" }}>Logistics built for East Africa, from signup to delivery</p>
          </div>

          <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Cargo Senders */}
            <div style={{ background: SRF, borderRadius: "20px", padding: "40px", border: "1px solid var(--border)", boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#fff", background: A, borderRadius: "6px", padding: "4px 10px", letterSpacing: "0.5px" }}>SENDER</span>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: P }}>For Cargo Senders</h3>
              </div>
              {[
                { step: "1", title: "Post Your Load", desc: "Describe your cargo, pickup & delivery, and set your budget." },
                { step: "2", title: "Receive Bids", desc: "Verified truck owners bid with their price and truck details." },
                { step: "3", title: "Track & Deliver", desc: "Accept the best bid and track your cargo live to delivery." },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i < 2 ? "28px" : "0" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: P, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", flexShrink: 0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: P, marginBottom: "5px" }}>{s.title}</div>
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Truck Owners */}
            <div style={{ background: P, borderRadius: "20px", padding: "40px", boxShadow: "0 8px 40px rgba(10,31,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: P, background: "rgba(255,255,255,0.9)", borderRadius: "6px", padding: "4px 10px", letterSpacing: "0.5px" }}>DRIVER</span>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#fff" }}>For Truck Owners</h3>
              </div>
              {[
                { step: "1", title: "Register Your Truck", desc: "List your truck type, capacity, and availability." },
                { step: "2", title: "Bid on Loads", desc: "Find loads matching your route and submit your best bid." },
                { step: "3", title: "Deliver & Earn", desc: "Win the bid, deliver the cargo, and get paid." },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i < 2 ? "28px" : "0" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: A, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", flexShrink: 0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#fff", marginBottom: "5px" }}>{s.title}</div>
                    <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: SRF }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", background: `rgba(10,31,68,0.07)`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: "700", color: P, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Features</div>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: P, letterSpacing: "-1px" }}>Everything You Need</h2>
            <p style={{ margin: 0, fontSize: "17px", color: "var(--text-secondary)" }}>Built specifically for East African logistics</p>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {[
              { icon: "📍", title: "Live GPS Tracking", desc: "Track your cargo in real-time from pickup to delivery on an interactive map." },
              { icon: "✅", title: "Verified Users Only", desc: "Every truck owner and cargo sender is verified by our admin team." },
              { icon: "🏷️", title: "Competitive Bidding", desc: "Truck owners bid on your load — you always get the best market price." },
              { icon: "🔔", title: "Instant Notifications", desc: "Get notified when a bid arrives, booking accepted, or cargo moves." },
              { icon: "🌍", title: "3 Countries Covered", desc: "Ship seamlessly across Ethiopia, Somalia, and Djibouti." },
              { icon: "🔒", title: "Secure & Reliable", desc: "All documents and data are secured and stored safely in our system." },
            ].map((f, i) => (
              <div key={i} style={{ padding: "32px", borderRadius: "16px", border: "1px solid var(--border)", background: BG, transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)"; }}
                onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ fontSize: "28px", marginBottom: "18px" }}>{f.icon}</div>
                <h3 style={{ margin: "0 0 10px", fontSize: "16px", fontWeight: "700", color: P }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COUNTRIES ─────────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: "#13316B", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(61,123,255,0.1) 0%, transparent 70%)" }} />
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(61,123,255,0.1)", border: "1px solid rgba(61,123,255,0.2)", borderRadius: "20px", padding: "6px 18px", marginBottom: "24px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5BE3C4", boxShadow: "0 0 6px #5BE3C4" }} />
            <span style={{ fontSize: "12px", color: A, letterSpacing: "1px", fontWeight: "600" }}>LIVE IN 3 COUNTRIES</span>
          </div>
          <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: "#fff", letterSpacing: "-1px" }}>Covering the Horn of Africa</h2>
          <p style={{ margin: "0 0 64px", fontSize: "17px", color: "rgba(255,255,255,0.45)" }}>One platform for cross-border freight across East Africa</p>
          <div className="countries-flex" style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { flag: "🇪🇹", country: "Ethiopia", city: "Addis Ababa", desc: "Largest economy in East Africa", accent: "#3D7BFF", routes: "120+ routes" },
              { flag: "🇸🇴", country: "Somalia", city: "Mogadishu", desc: "Strategic Horn of Africa location", accent: "#3D7BFF", routes: "80+ routes" },
              { flag: "🇩🇯", country: "Djibouti", city: "Djibouti City", desc: "Gateway port to the region", accent: "#3D7BFF", routes: "40+ routes" },
            ].map((c, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "40px 32px", minWidth: "250px", flex: 1, maxWidth: "320px" }}>
                <div style={{ fontSize: "60px", marginBottom: "20px", lineHeight: 1 }}>{c.flag}</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#fff", marginBottom: "4px" }}>{c.country}</div>
                <div style={{ fontSize: "13px", color: A, fontWeight: "600", marginBottom: "14px" }}>{c.city}</div>
                <div style={{ width: "36px", height: "2px", background: c.accent, borderRadius: "2px", margin: "0 auto 16px" }} />
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: "18px" }}>{c.desc}</div>
                <div style={{ display: "inline-block", background: "rgba(61,123,255,0.1)", border: "1px solid rgba(61,123,255,0.2)", borderRadius: "20px", padding: "4px 14px", fontSize: "12px", color: A, fontWeight: "600" }}>{c.routes}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUCK TYPES ──────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", background: `rgba(10,31,68,0.07)`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: "700", color: P, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Fleet</div>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: P, letterSpacing: "-1px" }}>All Truck Types</h2>
            <p style={{ margin: 0, fontSize: "17px", color: "var(--text-secondary)" }}>Whatever your cargo needs, we have the right truck</p>
          </div>
          <div className="trucks-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {[
              { emoji: "🚛", name: "Flatbed", desc: "Open cargo, construction materials" },
              { emoji: "❄️", name: "Refrigerated", desc: "Perishables, food, medicine" },
              { emoji: "⛽", name: "Tanker", desc: "Liquids, fuel, chemicals" },
              { emoji: "📦", name: "Container", desc: "Sealed goods, imports/exports" },
              { emoji: "🚚", name: "Open Body", desc: "Bulk goods, agriculture" },
              { emoji: "🛻", name: "Mini Truck", desc: "Small loads, city deliveries" },
            ].map((t, i) => (
              <div key={i} style={{ background: SRF, borderRadius: "14px", padding: "22px", display: "flex", alignItems: "center", gap: "16px", border: "1px solid var(--border)" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: `rgba(10,31,68,0.07)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{t.emoji}</div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: P }}>{t.name}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POPULAR ROUTES ──────────────────────────── */}
      <section style={{ padding: "100px 24px", background: SRF }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", background: `rgba(10,31,68,0.07)`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: "700", color: P, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Routes</div>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: P, letterSpacing: "-1px" }}>Popular Trade Routes</h2>
            <p style={{ margin: 0, fontSize: "17px", color: "var(--text-secondary)" }}>High-demand corridors across East Africa</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {[
              { from: "Addis Ababa", to: "Djibouti City", distance: "780 km", flag: "🇪🇹→🇩🇯", desc: "Primary import/export corridor", volume: "High" },
              { from: "Jigjiga", to: "Mogadishu", distance: "920 km", flag: "🇪🇹→🇸🇴", desc: "Cross-border trade route", volume: "Medium" },
              { from: "Dire Dawa", to: "Hargeisa", distance: "530 km", flag: "🇪🇹→🇸🇴", desc: "Regional distribution hub", volume: "High" },
            ].map((route, i) => (
              <div key={i} style={{ background: BG, borderRadius: "16px", padding: "24px", border: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: i === 0 ? A : i === 1 ? P : "#16a34a", borderRadius: "4px 0 0 4px" }} />
                <div style={{ fontSize: "22px", marginBottom: "12px" }}>{route.flag}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: P }}>{route.from}</span>
                  <span style={{ color: A, fontWeight: "800", fontSize: "16px" }}>→</span>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: P }}>{route.to}</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>{route.desc}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "99px", background: "#f0ede6", color: "var(--text-secondary)" }}>{route.distance}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: route.volume === "High" ? "#f0fdf4" : "#fff7ed", color: route.volume === "High" ? "#16a34a" : "#F59E0B" }}>{route.volume} Volume</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────── */}
      <section style={{ padding: "100px 24px", background: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", background: `rgba(10,31,68,0.07)`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: "700", color: P, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Testimonials</div>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "800", color: P, letterSpacing: "-1px" }}>Trusted by Shippers & Drivers</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {[
              { name: "Ahmed Hassan", role: "Cargo Sender · Addis Ababa", quote: "I posted a load at 8 AM and had three bids by noon. The verification gives me confidence that the truck owners are legitimate.", stars: 5 },
              { name: "Mustafa Ibrahim", role: "Truck Owner · Djibouti City", quote: "Before Sahid Freight I'd drive back empty half the time. Now I find return loads on the app and my income has doubled.", stars: 5 },
              { name: "Faadumo Abdi", role: "Logistics Manager · Mogadishu", quote: "The live tracking feature is a game changer. My clients can see exactly where their goods are at any moment.", stars: 5 },
            ].map((t, i) => (
              <div key={i} style={{ background: SRF, borderRadius: "16px", padding: "28px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "18px", color: A, marginBottom: "14px", letterSpacing: "2px" }}>{"★".repeat(t.stars)}</div>
                <p style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text)", lineHeight: 1.7, fontStyle: "italic" }}>"{t.quote}"</p>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: P }}>{t.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: `linear-gradient(135deg, ${P} 0%, #13316B 100%)`, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: `radial-gradient(circle, ${A} 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
        <div style={{ maxWidth: "640px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 52px)", fontWeight: "800", color: "#fff", letterSpacing: "-1.5px" }}>Ready to Get Started?</h2>
          <p style={{ margin: "0 0 48px", fontSize: "17px", color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>Join cargo senders and truck owners across East Africa. Free to sign up, verified in 24 hours.</p>
          <div className="cta-btns" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/auth/register")} style={{ background: A, border: "none", borderRadius: "12px", padding: "16px 44px", color: "#fff", fontSize: "16px", fontWeight: "800", cursor: "pointer", boxShadow: `0 8px 32px rgba(61,123,255,0.45)` }}>
              Sign Up Free →
            </button>
            <button onClick={() => router.push("/auth/login")} style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.35)", borderRadius: "12px", padding: "16px 44px", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
              Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer style={{ background: "#0A1F44", padding: "56px 40px 32px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="footer-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "40px", marginBottom: "48px" }}>
            <div style={{ maxWidth: "300px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <img src="/logo.svg" alt="Sahid Freight" style={{ height: "36px", width: "36px", objectFit: "contain", borderRadius: "8px" }} />
                <span style={{ fontSize: "19px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>Move Cargo. Connect East Africa. The trusted freight marketplace for Ethiopia, Somalia, and Djibouti.</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "8px" }}>
                <a href="mailto:info@sahidfreight.com" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>✉</span> info@sahidfreight.com
                </a>
                <a href="tel:+251911000000" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>📞</span> +251 911 000 000
                </a>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>📍</span> Addis Ababa, Ethiopia
                </div>
              </div>
            </div>
            <div className="footer-links" style={{ display: "flex", gap: "64px", flexWrap: "wrap" }}>
              {[
                { title: "Platform", links: ["How It Works", "Features", "Post a Load", "Register Truck"] },
                { title: "Routes", links: ["Ethiopia", "Somalia", "Djibouti", "Cross-border"] },
                { title: "Company", links: ["About Us", "Contact", "Privacy Policy", "Terms of Service"] },
              ].map((col, i) => (
                <div key={i}>
                  <h4 style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px" }}>{col.title}</h4>
                  {col.links.map(l => (
                    <div key={l} style={{ marginBottom: "10px" }}>
                      <a href="#" style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", textDecoration: "none" }}>{l}</a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>© 2026 Sahid Freight. All rights reserved.</p>
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>🇪🇹 Ethiopia · 🇸🇴 Somalia · 🇩🇯 Djibouti</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
