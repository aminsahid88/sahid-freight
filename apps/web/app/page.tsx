"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Radio, MapPin, ShieldCheck, Globe2, Wallet, BellRing,
  Truck, Snowflake, Fuel, Package, Boxes, CarFront,
  ArrowRight, Mail, PhoneCall, Clock,
} from "lucide-react";

import HeroFallback from "@/components/landing/HeroFallback";

const NAVY   = "var(--navy, #0A1F44)";
const BLUE   = "var(--accent, #3D7BFF)";
const TEAL   = "#5BE3C4";
const BG     = "var(--bg, #FFFFFF)";
const SRF    = "var(--surface, #F8FAFC)";
const TXT    = "var(--text, #0F172A)";
const TXT2   = "var(--text-secondary, #475569)";
const BD     = "var(--border, #E2E8F0)";
const NAVY_HEX = "#0A1F44";

/* Dynamic import: WebGL only client-side, only when actually rendered. */
const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), {
  ssr: false,
  loading: () => <HeroFallback label="LOADING" />,
});

/* ── Framer-motion helpers ────────────────────────────────────────── */

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function Reveal({ children, delay = 0, y = 32 }: { children: ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Count-up integer that starts when it enters the viewport. */
function CountUp({ to, suffix = "", duration = 1.4 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const rounded = useTransform(spring, (v) => `${Math.round(v).toLocaleString("en-US")}${suffix}`);

  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

/* ── The page ─────────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const [prefersReducedMotion, setPRM] = useState(false);
  const [stats, setStats] = useState({ loads: 0, trucks: 0 });

  useEffect(() => {
    // Redirect signed-in users
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (user && token) router.push("/dashboard");

    // Reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPRM(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPRM(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [router]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://sahid-freight-production.up.railway.app"}/stats/public`)
      .then((r) => r.json())
      .then((d) => setStats({ loads: Number(d.totalLoads) || 0, trucks: Number(d.totalTrucks) || 0 }))
      .catch(() => setStats({ loads: 0, trucks: 0 }));
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", background: BG, color: TXT, overflowX: "hidden", width: "100%" }}>
      <style>{`
        @media (max-width: 900px) {
          .hero-inner { padding: 100px 20px 60px !important; }
          .hero-copy { max-width: 100% !important; }
          .hero-h1 { font-size: clamp(36px, 10vw, 56px) !important; }
          .hero-scene-wrap { opacity: 0.55 !important; }
        }
        @media (max-width: 768px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .trucks-grid { grid-template-columns: 1fr 1fr !important; }
          .nav-ctas .nav-link { display: none !important; }
          .footer-row { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          background: "rgba(10,31,68,0.88)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 clamp(20px, 4vw, 40px)", boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ height: "36px", width: "36px", objectFit: "contain" }} />
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>Sahid Freight</span>
        </div>
        <div className="nav-ctas" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a href="#how" className="nav-link" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "none", fontSize: "13px", fontWeight: 500, padding: "8px 12px" }}>How it works</a>
          <a href="#features" className="nav-link" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "none", fontSize: "13px", fontWeight: 500, padding: "8px 12px" }}>Features</a>
          <button onClick={() => router.push("/auth/login")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.28)", borderRadius: "10px", padding: "8px 18px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Login</button>
          <button onClick={() => router.push("/auth/register")} style={{ background: BLUE, border: "none", borderRadius: "10px", padding: "9px 20px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Get started</button>
        </div>
      </nav>

      {/* ══════════════════ HERO ══════════════════ */}
      <section
        style={{
          position: "relative", minHeight: "100vh", background: NAVY_HEX,
          overflow: "hidden", isolation: "isolate",
        }}
      >
        {/* Scene layer (dynamic) */}
        <div className="hero-scene-wrap" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {prefersReducedMotion ? <HeroFallback /> : <HeroScene />}
        </div>

        {/* Vignette so headline stays legible over the globe */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            background:
              "linear-gradient(90deg, rgba(10,31,68,0.85) 0%, rgba(10,31,68,0.55) 42%, rgba(10,31,68,0.15) 70%, rgba(10,31,68,0) 100%)",
          }}
        />

        {/* Overlay content */}
        <div
          className="hero-inner"
          style={{
            position: "relative", zIndex: 2,
            maxWidth: "1240px", margin: "0 auto",
            padding: "148px clamp(24px, 5vw, 56px) 96px",
            minHeight: "100vh", display: "flex", alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div className="hero-copy" style={{ maxWidth: "620px" }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                background: "rgba(91,227,196,0.10)", border: "1px solid rgba(91,227,196,0.32)",
                borderRadius: "999px", padding: "6px 14px", marginBottom: "24px",
              }}
            >
              <span style={{ width: "7px", height: "7px", background: TEAL, borderRadius: "50%", boxShadow: `0 0 8px ${TEAL}` }} />
              <span style={{ color: TEAL, fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>LIVE ACROSS THE HORN OF AFRICA</span>
            </motion.div>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible"
              className="hero-h1"
              style={{
                margin: "0 0 24px",
                fontSize: "clamp(44px, 5.4vw, 76px)",
                fontWeight: 800, color: "#fff", lineHeight: 1.02, letterSpacing: "-2px",
              }}
            >
              The Horn of Africa
              <br />
              runs on trucks.
              <br />
              <span style={{ color: TEAL }}>Now it runs on Sahid.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.15 }}
              style={{
                margin: "0 0 40px",
                fontSize: "clamp(15px, 1.6vw, 18px)",
                color: "rgba(255,255,255,0.72)", lineHeight: 1.6, maxWidth: "520px",
              }}
            >
              Brokers dispatch verified trucks with live GPS across Ethiopia, Somalia,
              and Djibouti — so cargo owners know where their load is, from pickup
              to delivery.
            </motion.p>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.28 }}
              style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "56px" }}
            >
              <button
                onClick={() => router.push("/auth/register")}
                style={{
                  background: BLUE, border: "none", borderRadius: "12px",
                  padding: "15px 28px", color: "#fff", fontSize: "15px", fontWeight: 700,
                  cursor: "pointer", boxShadow: "0 12px 32px rgba(61,123,255,0.4)",
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  transition: "transform 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                Get started <ArrowRight size={16} strokeWidth={2.5} />
              </button>
              <a
                href="#how"
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "12px", padding: "15px 26px", color: "#fff", fontSize: "15px",
                  fontWeight: 600, cursor: "pointer", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              >
                See how it works
              </a>
            </motion.div>

            {/* Compact live-stats footer */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.42 }}
              style={{ display: "flex", gap: "clamp(24px, 4vw, 48px)", flexWrap: "wrap" }}
            >
              <StatBadge label="Loads posted" value={stats.loads} />
              <StatBadge label="Trucks on the network" value={stats.trucks} />
              <StatBadge label="Countries served" value={3} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how" style={{ padding: "clamp(72px, 10vh, 120px) 24px", background: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Reveal>
            <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
            <SectionTitle>From load to delivery in three steps.</SectionTitle>
            <SectionSub>Brokers handle the hard part — you see the truck moving.</SectionSub>
          </Reveal>

          <div
            className="steps-grid"
            style={{
              marginTop: "56px", display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gap: "20px",
            }}
          >
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <StepCard num={i + 1} icon={<s.icon size={22} strokeWidth={2} />} title={s.title} body={s.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" style={{ padding: "clamp(72px, 10vh, 120px) 24px", background: SRF }}>
        <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
          <Reveal>
            <SectionEyebrow>WHAT YOU GET</SectionEyebrow>
            <SectionTitle>Built for the way freight actually moves here.</SectionTitle>
            <SectionSub>Verified people. Live location. Payments that survive spotty networks.</SectionSub>
          </Reveal>

          <div
            className="features-grid"
            style={{
              marginTop: "56px", display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gap: "16px",
            }}
          >
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <FeatureCard icon={<f.icon size={22} strokeWidth={2} />} title={f.title} body={f.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ TRUCK TYPES ══════════════════ */}
      <section style={{ padding: "clamp(72px, 10vh, 120px) 24px", background: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <Reveal>
            <SectionEyebrow>FLEET</SectionEyebrow>
            <SectionTitle>Every kind of truck the corridor uses.</SectionTitle>
          </Reveal>

          <div
            className="trucks-grid"
            style={{
              marginTop: "48px", display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gap: "14px",
            }}
          >
            {TRUCKS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.06}>
                <TruckCard icon={<t.icon size={22} strokeWidth={2} />} name={t.name} body={t.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ CTA ══════════════════ */}
      <section style={{ padding: "clamp(72px, 10vh, 120px) 24px", background: NAVY_HEX, position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 50% 0%, rgba(61,123,255,0.18) 0%, transparent 60%)",
          }}
        />
        <Reveal>
          <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center", position: "relative" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
              Ready to move your first load?
            </h2>
            <p style={{ margin: "0 0 36px", fontSize: "17px", color: "rgba(255,255,255,0.62)", lineHeight: 1.6 }}>
              Free to sign up. Broker matches you with a verified truck.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/auth/register")}
                style={{
                  background: BLUE, border: "none", borderRadius: "12px",
                  padding: "15px 32px", color: "#fff", fontSize: "15px", fontWeight: 700,
                  cursor: "pointer", boxShadow: "0 12px 32px rgba(61,123,255,0.4)",
                  display: "inline-flex", alignItems: "center", gap: "8px",
                }}
              >
                Get started <ArrowRight size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => router.push("/auth/login")}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.28)", borderRadius: "12px",
                  padding: "15px 32px", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer",
                }}
              >
                I already have an account
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer style={{ background: NAVY_HEX, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "44px 24px 32px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="footer-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "32px", marginBottom: "32px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <img src="/logo.svg" alt="Sahid Freight" style={{ height: "32px", width: "32px", objectFit: "contain" }} />
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Sahid Freight</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.42)", lineHeight: 1.6, maxWidth: "280px" }}>
                Freight for Ethiopia, Somalia, and Djibouti.
              </p>
            </div>

            <div style={{ display: "flex", gap: "56px", flexWrap: "wrap" }}>
              <FooterCol title="Platform" items={[
                { label: "How it works", href: "#how" },
                { label: "Features",     href: "#features" },
                { label: "Sign up",      href: "/auth/register" },
                { label: "Log in",       href: "/auth/login" },
              ]} />
              <FooterCol title="Company" items={[
                { label: "Privacy policy", href: "/privacy-policy" },
                { label: "Contact",        href: "mailto:info@sahidfreight.com" },
              ]} />
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.28)" }}>
              © {new Date().getFullYear()} Sahid Freight. All rights reserved.
            </p>
            <a
              href="mailto:info@sahidfreight.com"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.42)", fontSize: "13px", textDecoration: "none" }}
            >
              <Mail size={14} /> info@sahidfreight.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Small typed sub-components ──────────────────────────────────── */

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
        <CountUp to={value} />
      </div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.42)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginTop: "4px" }}>
        {label}
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 800, color: BLUE, letterSpacing: "1.6px", marginBottom: "12px" }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 3.6vw, 44px)", fontWeight: 800, color: NAVY_HEX, letterSpacing: "-1.1px", lineHeight: 1.1, maxWidth: "780px" }}>
      {children}
    </h2>
  );
}
function SectionSub({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: "17px", color: TXT2, lineHeight: 1.6, maxWidth: "600px" }}>
      {children}
    </p>
  );
}

function StepCard({ num, icon, title, body }: { num: number; icon: ReactNode; title: string; body: string }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${BD}`, borderRadius: "18px",
      padding: "28px", height: "100%", boxSizing: "border-box",
      boxShadow: "0 1px 2px rgba(10,31,68,0.03)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `${NAVY_HEX}`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <span style={{ fontSize: "11px", fontWeight: 800, color: BLUE, letterSpacing: "1.4px" }}>STEP {num}</span>
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: NAVY_HEX, letterSpacing: "-0.3px" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "14px", color: TXT2, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${BD}`, borderRadius: "16px",
      padding: "26px", height: "100%", boxSizing: "border-box",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(10,31,68,0.08)"; }}
      onMouseOut={(e)  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(61,123,255,0.10)", color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
        {icon}
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: NAVY_HEX }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "14px", color: TXT2, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function TruckCard({ icon, name, body }: { icon: ReactNode; name: string; body: string }) {
  return (
    <div style={{
      background: SRF, border: `1px solid ${BD}`, borderRadius: "14px",
      padding: "20px", display: "flex", alignItems: "center", gap: "14px",
    }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#fff", color: NAVY_HEX, border: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: NAVY_HEX }}>{name}</div>
        <div style={{ fontSize: "12px", color: TXT2, marginTop: "2px" }}>{body}</div>
      </div>
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 12px", fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.32)", letterSpacing: "1.6px", textTransform: "uppercase" }}>
        {title}
      </h4>
      {items.map((it) => (
        <div key={it.label} style={{ marginBottom: "8px" }}>
          <a href={it.href} style={{ color: "rgba(255,255,255,0.58)", fontSize: "13px", textDecoration: "none" }}>
            {it.label}
          </a>
        </div>
      ))}
    </div>
  );
}

/* ── Content ──────────────────────────────────────────────────────── */

const STEPS = [
  { icon: Package,   title: "Post or call in a load", body: "Cargo owners post loads themselves — or a broker enters it on their behalf." },
  { icon: Truck,     title: "A broker dispatches a truck", body: "A verified truck matching your route and cargo type is dispatched in minutes." },
  { icon: MapPin,    title: "Track it live to delivery", body: "Watch the truck move on a live GPS map. Both sides are notified at every step." },
] as const;

const FEATURES = [
  { icon: Radio,       title: "Broker dispatch",    body: "Loads matched to verified trucks in minutes — even if the cargo owner is offline." },
  { icon: MapPin,      title: "Live GPS tracking",  body: "See exactly where the truck is between pickup and delivery, in real time." },
  { icon: ShieldCheck, title: "Verified fleet",     body: "Every truck owner, driver, and truck is verified by the Sahid team before dispatch." },
  { icon: Globe2,      title: "Cross-border ready", body: "One network across Ethiopia, Somalia, and Djibouti — plates, ports, and corridors." },
  { icon: Wallet,      title: "Offline-friendly payments", body: "Brokers record cash collections and payouts in the app — nothing gets lost." },
  { icon: BellRing,    title: "Instant notifications", body: "Push and in-app alerts the moment a truck accepts, moves, or delivers." },
] as const;

const TRUCKS = [
  { icon: Truck,     name: "Flatbed",      body: "Open cargo, construction materials" },
  { icon: Snowflake, name: "Refrigerated", body: "Perishables, food, medicine" },
  { icon: Fuel,      name: "Tanker",       body: "Liquids, fuel, chemicals" },
  { icon: Package,   name: "Container",    body: "Sealed goods, imports and exports" },
  { icon: Boxes,     name: "Open body",    body: "Bulk goods, agriculture" },
  { icon: CarFront,  name: "Mini truck",   body: "Small loads, city deliveries" },
] as const;
