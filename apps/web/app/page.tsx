"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function LandingPage() {
  const router = useRouter();
  useEffect(() => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (user && token) router.push("/dashboard");
  }, []);
  
  



  return (
<div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#fff", color: "#1a2744" }}>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "rgba(26,39,68,0.97)", backdropFilter: "blur(10px)", padding: "0 20px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "38px", width: "38px", objectFit: "contain", borderRadius: "8px" }} />
          <span style={{ fontSize: "20px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-0.5px" }}>Sahid Freight</span>
        </div>
        <div className="nav-ctas" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => router.push("/auth/login")} style={{ background: "transparent", border: "1px solid rgba(240,235,224,0.4)", borderRadius: "8px", padding: "8px 20px", color: "#f0ebe0", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Login</button>
          <button onClick={() => router.push("/auth/register")} style={{ background: "#c8901e", border: "none", borderRadius: "8px", padding: "8px 20px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Get Started →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a2744 0%, #0f1a35 50%, #1a2744 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "120px 24px 60px" }}>
        {/* Background pattern */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, #c8901e 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div style={{ position: "absolute", top: "20%", right: "10%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(200,144,30,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "5%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(200,144,30,0.08) 0%, transparent 70%)", borderRadius: "50%" }} />

        <div style={{ maxWidth: "900px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(200,144,30,0.15)", border: "1px solid rgba(200,144,30,0.3)", borderRadius: "99px", padding: "6px 16px", marginBottom: "32px" }}>
            <span style={{ width: "8px", height: "8px", background: "#c8901e", borderRadius: "50%", display: "inline-block" }} />
            <span style={{ color: "#c8901e", fontSize: "13px", fontWeight: "600" }}>Now live in Ethiopia, Somalia & Djibouti</span>
          </div>

          <h1 className="hero-h1" style={{ margin: "0 0 24px", fontSize: "clamp(38px, 7vw, 80px)", fontWeight: "900", color: "#f0ebe0", lineHeight: 1.05, letterSpacing: "-2px" }}>
            Move Cargo.<br />
            <span style={{ color: "#c8901e" }}>Connect East Africa.</span>
          </h1>

          <p style={{ margin: "0 0 48px", fontSize: "clamp(16px, 2.5vw, 22px)", color: "rgba(240,235,224,0.7)", lineHeight: 1.6, maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
            The fastest way to connect cargo senders with trusted truck owners across Ethiopia, Somalia, and Djibouti.
          </p>

          <div className="hero-btns" style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginBottom: "64px" }}>
            <button onClick={() => router.push("/auth/register")} style={{ background: "#c8901e", border: "none", borderRadius: "12px", padding: "16px 36px", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: "0 8px 32px rgba(200,144,30,0.4)", transition: "transform 0.2s" }}
              onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
              Start Shipping →
            </button>
            <button onClick={() => router.push("/auth/register")} style={{ background: "rgba(240,235,224,0.1)", border: "1px solid rgba(240,235,224,0.2)", borderRadius: "12px", padding: "16px 36px", color: "#f0ebe0", fontSize: "16px", fontWeight: "600", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
              Register Your Truck
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stats" style={{ display: "flex", gap: "48px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { value: "3", label: "Countries" },
              { value: "6+", label: "Truck Types" },
              { value: "24h", label: "Verification" },
              { value: "100%", label: "Verified Users" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "36px", fontWeight: "900", color: "#c8901e", letterSpacing: "-1px" }}>{s.value}</div>
                <div style={{ fontSize: "13px", color: "rgba(240,235,224,0.5)", fontWeight: "500", marginTop: "4px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "100px 24px", background: "#f0ebe0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#1a2744", letterSpacing: "-1px" }}>How It Works</h2>
            <p style={{ margin: 0, fontSize: "18px", color: "#6b7280", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>Simple, fast, and reliable logistics for East Africa</p>
          </div>

          <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
            {/* Cargo Senders */}
            <div style={{ background: "#fff", borderRadius: "24px", padding: "40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
                <span style={{ fontSize: "13px", fontWeight: "800", color: "#f0ebe0", background: "#c8901e", borderRadius: "6px", padding: "4px 8px" }}>SENDER</span>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744" }}>For Cargo Senders</h3>
              </div>
              {[
                { step: "1", title: "Post Your Load", desc: "Describe your cargo, pickup and delivery locations, and your budget." },
                { step: "2", title: "Receive Applications", desc: "Verified truck owners apply with their price and truck details." },
                { step: "3", title: "Track & Deliver", desc: "Accept the best offer and track your cargo live until delivery." },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i < 2 ? "24px" : "0" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a2744", color: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", flexShrink: 0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a2744", marginBottom: "4px" }}>{s.title}</div>
                    <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Truck Owners */}
            <div style={{ background: "#1a2744", borderRadius: "24px", padding: "40px", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
                <span style={{ fontSize: "13px", fontWeight: "800", color: "#1a2744", background: "#f0ebe0", borderRadius: "6px", padding: "4px 8px" }}>DRIVER</span>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#f0ebe0" }}>For Truck Owners</h3>
              </div>
              {[
                { step: "1", title: "Register Your Truck", desc: "List your truck with type, capacity, and availability." },
                { step: "2", title: "Browse Available Loads", desc: "Find loads matching your route and apply with your best price." },
                { step: "3", title: "Get Paid", desc: "Complete the delivery and receive payment securely." },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i < 2 ? "24px" : "0" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#c8901e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", flexShrink: 0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#f0ebe0", marginBottom: "4px" }}>{s.title}</div>
                    <div style={{ fontSize: "14px", color: "rgba(240,235,224,0.6)", lineHeight: "1.5" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#1a2744", letterSpacing: "-1px" }}>Everything You Need</h2>
            <p style={{ margin: 0, fontSize: "18px", color: "#6b7280" }}>Built specifically for East African logistics</p>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { icon: "📍", title: "Live GPS Tracking", desc: "Track your cargo in real-time from pickup to delivery on an interactive map." },
              { icon: "check", title: "Verified Users Only", desc: "Every truck owner and cargo sender is verified by our admin team before using the platform." },
              { icon: "PRC", title: "Best Price Guarantee", desc: "Competitive bidding ensures you always get the best price for your shipment." },
              { icon: "NTF", title: "Instant Notifications", desc: "Get notified immediately when your booking is accepted, rejected, or your cargo moves." },
              { icon: "GBL", title: "3 Countries Covered", desc: "Seamlessly ship across Ethiopia, Somalia, and Djibouti with one platform." },
              { icon: "shield", title: "Secure & Reliable", desc: "All transactions and documents are secured and stored safely in our system." },
            ].map((f, i) => (
              <div key={i} style={{ padding: "32px", borderRadius: "20px", border: "1px solid #f0ebe0", background: "#faf8f4", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)"; }}
                onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(26,39,68,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "#1a2744" }}>
                {f.icon === "package" ? <Package size={24} /> : f.icon === "truck" ? <Truck size={24} /> : f.icon === "dollar" ? <DollarSign size={24} /> : f.icon === "bell" ? <Bell size={24} /> : f.icon === "globe" ? <Globe size={24} /> : f.icon === "check" ? <CheckCircle size={24} /> : <Shield size={24} />}
              </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: "700", color: "#1a2744" }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: "1.6" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COUNTRIES */}
      <section style={{ padding: "100px 24px", background: "#1a2744" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#f0ebe0", letterSpacing: "-1px" }}>Covering the Horn of Africa</h2>
          <p style={{ margin: "0 0 64px", fontSize: "18px", color: "rgba(240,235,224,0.6)" }}>One platform for cross-border freight across East Africa</p>
          <div className="countries-flex" style={{ display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { flag: "🇪��", country: "Ethiopia", city: "Addis Ababa", desc: "Largest economy in East Africa" },
              { flag: "SO", country: "Somalia", city: "Mogadishu", desc: "Strategic Horn of Africa location" },
              { flag: "DJ", country: "Djibouti", city: "Djibouti City", desc: "Gateway port to the region" },
            ].map((c, i) => (
              <div key={i} style={{ background: "rgba(240,235,224,0.06)", border: "1px solid rgba(240,235,224,0.1)", borderRadius: "24px", padding: "40px 48px", minWidth: "260px", flex: 1, maxWidth: "320px" }}>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#c8901e", marginBottom: "12px", background: "rgba(200,144,30,0.15)", borderRadius: "8px", padding: "8px 16px", display: "inline-block" }}>{c.flag}</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#f0ebe0", marginBottom: "4px" }}>{c.country}</div>
                <div style={{ fontSize: "14px", color: "#c8901e", fontWeight: "600", marginBottom: "8px" }}>{c.city}</div>
                <div style={{ fontSize: "13px", color: "rgba(240,235,224,0.5)" }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUCK TYPES */}
      <section style={{ padding: "100px 24px", background: "#f0ebe0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#1a2744", letterSpacing: "-1px" }}>All Truck Types</h2>
            <p style={{ margin: 0, fontSize: "18px", color: "#6b7280" }}>Whatever your cargo needs, we have the right truck</p>
          </div>
          <div className="trucks-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {[
              { icon: "truck", name: "Flatbed", desc: "Open cargo, construction materials" },
              { icon: "RF", name: "Refrigerated", desc: "Perishables, food, medicine" },
              { icon: "TK", name: "Tanker", desc: "Liquids, fuel, chemicals" },
              { icon: "PKG", name: "Container", desc: "Sealed goods, imports/exports" },
              { icon: "OB", name: "Open Body", desc: "Bulk goods, agriculture" },
              { icon: "MT", name: "Mini Truck", desc: "Small loads, city deliveries" },
            ].map((t, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "16px", padding: "24px", display: "flex", alignItems: "center", gap: "16px", border: "1px solid #e8e3d8" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a2744", flexShrink: 0 }}>
                {t.icon === "flatbed" ? <Truck size={18} /> : t.icon === "refrigerated" ? <Box size={18} /> : t.icon === "tanker" ? <Fuel size={18} /> : t.icon === "container" ? <Container size={18} /> : t.icon === "openBody" ? <Box size={18} /> : <Minimize2 size={18} />}
              </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a2744" }}>{t.name}</div>
                  <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "2px" }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 24px", background: "linear-gradient(135deg, #c8901e 0%, #a06e10 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 52px)", fontWeight: "900", color: "#fff", letterSpacing: "-1px" }}>Ready to Get Started?</h2>
          <p style={{ margin: "0 0 48px", fontSize: "18px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>Join thousands of cargo senders and truck owners across East Africa. Free to sign up, verified in 24 hours.</p>
          <div className="cta-btns" style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/auth/register")} style={{ background: "#fff", border: "none", borderRadius: "12px", padding: "16px 40px", color: "#c8901e", fontSize: "16px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
              Sign Up Free →
            </button>
            <button onClick={() => router.push("/auth/login")} style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "12px", padding: "16px 40px", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
              Login
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0f1a35", padding: "48px 40px 32px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="footer-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "32px", marginBottom: "48px" }}>
            <div style={{ maxWidth: "280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "36px", width: "36px", objectFit: "contain", borderRadius: "8px" }} />
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-0.5px" }}>Sahid Freight</span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "rgba(240,235,224,0.5)", lineHeight: 1.6 }}>Move Cargo. Connect East Africa. The trusted freight marketplace for Ethiopia, Somalia, and Djibouti.</p>
            </div>
            <div className="footer-links" style={{ display: "flex", gap: "64px", flexWrap: "wrap" }}>
              <div>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "700", color: "rgba(240,235,224,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Platform</h4>
                {["How It Works", "Features", "Pricing", "FAQ"].map(l => (
                  <div key={l} style={{ marginBottom: "10px" }}>
                    <a href="#" style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px", textDecoration: "none" }}>{l}</a>
                  </div>
                ))}
              </div>
              <div>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "700", color: "rgba(240,235,224,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Countries</h4>
                {["Ethiopia", "Somalia", "Djibouti"].map(l => (
                  <div key={l} style={{ marginBottom: "10px" }}>
                    <a href="#" style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px", textDecoration: "none" }}>{l}</a>
                  </div>
                ))}
              </div>
              <div>
                <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: "700", color: "rgba(240,235,224,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Company</h4>
                {["About Us", "Contact", "Privacy Policy", "Terms"].map(l => (
                  <div key={l} style={{ marginBottom: "10px" }}>
                    <a href="#" style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px", textDecoration: "none" }}>{l}</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(240,235,224,0.08)", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(240,235,224,0.3)" }}>© 2026 Sahid Freight. All rights reserved.</p>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(240,235,224,0.3)" }}>Ethiopia · Somalia · Djibouti</p>
          </div>
        </div>
      </footer>
    </div>
  );
}