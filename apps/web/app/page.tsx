import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarClock, FileSearch, Inbox, ShieldCheck, Smartphone } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Motion";
import { SiteFooter, SiteHeader } from "@/components/marketing/Site";

export const metadata: Metadata = {
  title: "Sahid Freight — Trucking back office, done for you",
  description: "Send us your paperwork. Get clean books and IFTA-ready numbers, checked by AI and confirmed by a person.",
};

const PROMISES = [
  {
    icon: <Smartphone size={20} />,
    title: "You never type data",
    body: "Drivers send receipts from their phone. Fuel-card statements and ELD mileage reports import in one step. We do the rest.",
  },
  {
    icon: <FileSearch size={20} />,
    title: "Every number has a receipt behind it",
    body: "Two independent AI reads, deterministic checks, and a human reviewer. Missing or unreadable values are flagged, never invented.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Audit-ready for four years",
    body: "Originals are stored unchanged with a fingerprint and a full history of who changed what, kept for the IFTA retention period.",
  },
];

const STEPS = [
  { n: "01", title: "Send", body: "Upload, email, or text fuel receipts, statements and ELD mileage." },
  { n: "02", title: "We check", body: "AI extracts every field twice; rules catch duplicates, bad math and missing details." },
  { n: "03", title: "You approve", body: "Review only what needs you. One tap per correction." },
  { n: "04", title: "Download", body: "Quarter report, transactions CSV, supporting documents, and an IFTA worksheet for your preparer." },
];

const PLANS = [
  { name: "Starter", who: "1–2 trucks", price: "$79", per: "/month", note: "Receipts, review, quarter report" },
  { name: "Fleet", who: "3–10 trucks", price: "$149", per: "/month + $15/truck", note: "Everything in Starter, drivers on the capture app", featured: true },
  { name: "IFTA only", who: "Any size", price: "$99", per: "/quarter", note: "One preparer-ready IFTA worksheet" },
];

const FAQ = [
  { q: "Do you file my IFTA return?", a: "No. We prepare a worksheet with every number traced to its receipt and mileage record. You or your preparer file it. Nothing is filed, sent or paid without your approval." },
  { q: "What if a receipt is blurry or missing a field?", a: "The value is left empty and flagged. Our reviewer or you fill it in from the source. We never guess a number." },
  { q: "Which fuel cards and ELDs do you support?", a: "Any fuel-card statement export (Comdata, WEX/EFS, AtoB, TCS or a generic CSV) and any ELD jurisdiction-mileage report. Direct integrations come later." },
];

/** Fictional fleet, the same figures as docs/05. */
const WORKSHEET = [
  ["OH", "12,500", "2,000.000", "2,600.000", "−600.000"],
  ["IN", "10,000", "1,600.000", "1,200.000", "400.000"],
  ["IL", "7,500", "1,200.000", "1,000.000", "200.000"],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen text-ink">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="aurora pointer-events-none absolute -left-32 -top-48 h-[36rem] w-[36rem] rounded-full bg-accent/25 blur-3xl" />
          <div aria-hidden className="aurora pointer-events-none absolute right-[-10rem] top-10 h-[30rem] w-[30rem] rounded-full bg-accent-2/25 blur-3xl" style={{ animationDelay: "-7s" }} />
          <div className="relative mx-auto max-w-content px-5 pb-16 pt-20 md:pb-24 md:pt-28">
            <Reveal>
              <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 shadow-card">
                <CalendarClock size={13} className="text-accent" />
                Q4 2026 IFTA returns due Feb 1, 2027
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="max-w-4xl text-[44px] font-semibold leading-[1.02] display md:text-[72px]">
                Send us your paperwork.
                <br />
                <span className="text-gradient">Get clean books and IFTA-ready numbers.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-2">
                For small trucking carriers who do their own back office. Snap a receipt, forward an email, or text a photo. Every
                number is checked by AI, confirmed by a person, and traceable to its receipt.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <LinkButton href="/auth/sign-up" size="lg" icon={<ArrowRight size={18} />}>
                  Start with your Q4 quarter
                </LinkButton>
                <LinkButton href="#how" variant="secondary" size="lg">
                  See how a quarter gets done
                </LinkButton>
              </div>
              <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-3">1–10 truck fleets · nothing filed without your approval</p>
            </Reveal>

            {/* Product proof card: what a quarter looks like inside */}
            <Reveal delay={0.26} className="mt-14">
              <div className="glass hairline-gradient mx-auto grid max-w-3xl gap-6 rounded-card p-6 shadow-card md:grid-cols-[1fr_1.2fr]">
                <div>
                  <div className="label-caps">Quarter at a glance · fictional fleet</div>
                  <div className="mt-3 text-[40px] font-semibold leading-none tnum display">
                    <span className="text-gradient">3 trucks</span>
                  </div>
                  <div className="mt-2 text-[13px] text-ink-2">30,000 miles · 4,800 gallons · 10 jurisdictions · every number traced to a receipt or an ELD row</div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                    <div className="rounded-control bg-surface2 p-3">
                      <div className="label-caps">Fleet MPG</div>
                      <div className="mt-1 text-xl font-semibold tnum">6.25</div>
                    </div>
                    <div className="rounded-control bg-surface2 p-3">
                      <div className="label-caps">Status</div>
                      <div className="mt-1 text-xl font-semibold text-warning">Preliminary</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-control bg-surface2 p-4 font-mono text-[12px] leading-relaxed text-ink-2">
                  <div className="mb-2 label-caps">IFTA worksheet</div>
                  <table className="w-full tnum">
                    <thead className="text-left text-ink-3">
                      <tr>
                        <th className="pb-2 font-medium">Jur.</th>
                        <th className="pb-2 font-medium text-right">Taxable mi</th>
                        <th className="pb-2 font-medium text-right">Consumed</th>
                        <th className="pb-2 font-medium text-right">Net gal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {WORKSHEET.map((r) => (
                        <tr key={r[0]} className="border-t border-line">
                          <td className="py-1.5 text-ink">{r[0]}</td>
                          <td className="py-1.5 text-right">{r[1]}</td>
                          <td className="py-1.5 text-right">{r[2]}</td>
                          <td className={`py-1.5 text-right ${r[4].startsWith("−") ? "text-mint" : ""}`}>{r[4]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-[11px] text-ink-3">Rates from the official table · every rounding step shown</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Promises */}
        <section className="mx-auto max-w-content px-5 py-10 md:py-16">
          <div className="grid gap-5 md:grid-cols-3">
            {PROMISES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <div className="glass h-full rounded-card p-7 shadow-card transition-shadow hover:shadow-card-hover">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-dim text-accent">{p.icon}</div>
                  <h3 className="text-[17px] font-semibold display">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-content px-5 py-20">
          <Reveal>
            <div className="max-w-2xl">
              <div className="label-caps text-accent">How it works</div>
              <h2 className="mt-3 text-3xl font-semibold display md:text-[44px]">A quarter, done in four steps</h2>
              <p className="mt-4 text-ink-2">You spend minutes, not weekends. We handle the sorting, the checking and the math.</p>
            </div>
          </Reveal>
          <ol className="mt-12 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.07}>
                <li className="glass hairline-gradient h-full rounded-card p-6 shadow-card">
                  <div className="font-mono text-[12px] text-accent">{s.n}</div>
                  <div className="mt-3 text-lg font-semibold display">{s.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* IFTA */}
        <section id="ifta" className="relative overflow-hidden bg-[#070b14] text-white">
          <div aria-hidden className="aurora pointer-events-none absolute -left-32 top-0 h-[30rem] w-[30rem] rounded-full bg-[#3d7bff]/30 blur-3xl" />
          <div aria-hidden className="aurora pointer-events-none absolute -right-32 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[#5be3c4]/20 blur-3xl" style={{ animationDelay: "-9s" }} />
          <div className="relative mx-auto grid max-w-content items-center gap-12 px-5 py-24 md:grid-cols-2">
            <Reveal>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#9bb8ff]">IFTA quarters</div>
              <h2 className="mt-3 text-3xl font-semibold display md:text-[44px]">Preparer-ready, every quarter</h2>
              <p className="mt-5 text-[15px] leading-relaxed text-white/75">
                We combine verified fuel purchases with your ELD mileage by jurisdiction, apply the official rate table for the quarter,
                and show every formula and rounding step. Reefer fuel and DEF are kept out of your taxable gallons.
              </p>
              <ul className="mt-7 space-y-3 text-[15px]">
                {["Per-jurisdiction miles, gallons consumed, tax-paid gallons and net gallons", "Fleet MPG computed with decimal math, not spreadsheets", "Labeled PRELIMINARY until every error is resolved and you approve"].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#5be3c4]" />
                    <span className="text-white/85">{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="rounded-card border border-white/10 bg-white/5 p-6 font-mono text-[13px] leading-relaxed text-[#dce4f2] shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#9bb8ff]">Sample worksheet · fictional fleet</div>
                <table className="w-full tnum">
                  <thead className="text-left text-[#9bb8ff]">
                    <tr>
                      <th className="pb-2 font-medium">Jur.</th>
                      <th className="pb-2 font-medium text-right">Taxable mi</th>
                      <th className="pb-2 font-medium text-right">Consumed</th>
                      <th className="pb-2 font-medium text-right">Tax-paid</th>
                      <th className="pb-2 font-medium text-right">Net gal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WORKSHEET.map((r) => (
                      <tr key={r[0]} className="border-t border-white/10">
                        {r.map((c, i) => (
                          <td key={i} className={`py-1.5 ${i ? "text-right" : ""} ${i === 4 && c.startsWith("−") ? "text-[#5be3c4]" : ""}`}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-xs text-[#9bb8ff]">Fleet MPG 6.25 · 30,000 miles ÷ 4,800 gal · status PRELIMINARY</div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-content px-5 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="glass h-full rounded-card p-7 shadow-card">
                <Inbox size={22} className="text-accent" />
                <h3 className="mt-4 text-xl font-semibold display">Owner-operators and small fleets</h3>
                <p className="mt-2 text-ink-2">Interstate carriers with 1–10 power units who do the paperwork themselves and would rather drive.</p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="glass h-full rounded-card p-7 shadow-card">
                <BadgeCheck size={22} className="text-accent" />
                <h3 className="mt-4 text-xl font-semibold display">Bookkeepers and IFTA services</h3>
                <p className="mt-2 text-ink-2">Manage many carriers with clean, traceable paperwork. Partner access is coming after the pilot.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-content px-5 py-20">
          <Reveal>
            <div className="max-w-2xl">
              <div className="label-caps text-accent">Pilot pricing</div>
              <h2 className="mt-3 text-3xl font-semibold display md:text-[44px]">Priced like software, delivered like a service</h2>
              <p className="mt-4 text-ink-2">Simple monthly plans during the pilot. No contracts. Cancel any time.</p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className={`glass relative h-full rounded-card p-7 shadow-card ${p.featured ? "ring-1 ring-accent" : ""}`}>
                  {p.featured && <span className="btn-gradient absolute -top-3 left-6 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white shadow-button">Most chosen</span>}
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold display">{p.name}</div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{p.who}</div>
                  </div>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className={`text-[44px] font-semibold leading-none tnum display ${p.featured ? "text-gradient" : ""}`}>{p.price}</span>
                    <span className="text-sm text-ink-2">{p.per}</span>
                  </div>
                  <p className="mt-4 text-sm text-ink-2">{p.note}</p>
                  <LinkButton href="/auth/sign-up" variant={p.featured ? "primary" : "secondary"} className="mt-7 w-full">
                    Get started
                  </LinkButton>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-xs text-ink-3">Partner pricing for bookkeepers and service firms is set per company. Ask us.</p>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-content px-5 py-20">
          <Reveal>
            <h2 className="text-3xl font-semibold display md:text-[44px]">Questions</h2>
          </Reveal>
          <dl className="mt-10 grid gap-5 md:grid-cols-2">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={(i % 2) * 0.06}>
                <div className="glass h-full rounded-card p-6 shadow-card">
                  <dt className="font-semibold display">{f.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-content px-5 pb-24">
          <Reveal>
            <div className="glass hairline-gradient relative overflow-hidden rounded-card p-10 shadow-card">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-2/25 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-semibold display md:text-[32px]">Start now and your quarter is ready before the deadline.</h2>
                  <p className="mt-2 text-ink-2">Set up takes ten minutes: your trucks, your drivers, and the first batch of receipts.</p>
                </div>
                <LinkButton href="/auth/sign-up" size="lg" icon={<ArrowRight size={18} />}>
                  Create your account
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
