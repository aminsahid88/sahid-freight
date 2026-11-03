import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarClock, FileSearch, Inbox, ShieldCheck, Smartphone } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
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
  { q: "Is it available in Somali?", a: "Yes. The owner screens, notifications and report summaries are available in English and Somali." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-content px-5 pt-16 pb-14 md:pt-24 md:pb-20">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-2">
              <CalendarClock size={14} className="text-accent" />
              Q4 2026 IFTA returns are due February 1, 2027
            </div>
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] md:text-[60px]">
              Send us your paperwork.
              <br />
              <span className="text-accent">Get clean books and IFTA-ready numbers.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-2">
              For small trucking carriers who do their own back office. Snap a receipt, forward an email, or text a photo.
              Every number is checked by AI, confirmed by a person, and traceable to its receipt.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/auth/sign-up" size="lg" icon={<ArrowRight size={18} />}>
                Start with your Q4 quarter
              </LinkButton>
              <LinkButton href="#how" variant="secondary" size="lg">
                See how a quarter gets done
              </LinkButton>
            </div>
            <p className="mt-5 text-[13px] text-ink-3">
              Built for 1–10 truck fleets. English and Somali. Nothing is filed without your approval.
            </p>
          </div>
        </section>

        {/* Promises */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-content gap-5 px-5 py-14 md:grid-cols-3">
            {PROMISES.map((p) => (
              <div key={p.title} className="rounded-card border border-line bg-canvas p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-control bg-accent-dim text-accent">{p.icon}</div>
                <h3 className="text-[17px] font-bold">{p.title}</h3>
                <p className="mt-2 text-sm text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-content px-5 py-20">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">How it works</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">A quarter, done in four steps</h2>
            <p className="mt-3 text-ink-2">You spend minutes, not weekends. We handle the sorting, the checking and the math.</p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-card border border-line p-6">
                <div className="font-mono text-xs font-semibold text-ink-3">{s.n}</div>
                <div className="mt-2 text-lg font-bold">{s.title}</div>
                <p className="mt-2 text-sm text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* IFTA */}
        <section id="ifta" className="border-y border-line bg-navy text-white">
          <div className="mx-auto grid max-w-content items-center gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#9BB8FF]">IFTA quarters</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Preparer-ready, every quarter</h2>
              <p className="mt-4 text-[15px] text-[#C7D2E6]">
                We combine verified fuel purchases with your ELD mileage by jurisdiction, apply the official rate table for the
                quarter, and show every formula and rounding step. Reefer fuel and DEF are kept out of your taxable gallons.
              </p>
              <ul className="mt-6 space-y-3 text-[15px]">
                {["Per-jurisdiction miles, gallons consumed, tax-paid gallons and net gallons", "Fleet MPG computed with decimal math, not spreadsheets", "Labeled PRELIMINARY until every error is resolved and you approve"].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#5BE3C4]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-white/10 bg-white/5 p-6 font-mono text-[13px] leading-relaxed text-[#DCE4F2]">
              <div className="mb-3 text-xs font-sans font-semibold uppercase tracking-wider text-[#9BB8FF]">Sample worksheet · fictional fleet</div>
              <table className="w-full tnum">
                <thead className="text-left text-[#9BB8FF]">
                  <tr>
                    <th className="pb-2 font-medium">Jur.</th>
                    <th className="pb-2 font-medium text-right">Taxable mi</th>
                    <th className="pb-2 font-medium text-right">Consumed</th>
                    <th className="pb-2 font-medium text-right">Tax-paid</th>
                    <th className="pb-2 font-medium text-right">Net gal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["OH", "12,500", "2,000.000", "2,600.000", "−600.000"],
                    ["IN", "10,000", "1,600.000", "1,200.000", "400.000"],
                    ["IL", "7,500", "1,200.000", "1,000.000", "200.000"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t border-white/10">
                      {r.map((c, i) => (
                        <td key={i} className={`py-1.5 ${i ? "text-right" : ""}`}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-xs text-[#9BB8FF]">Fleet MPG 6.25 · 30,000 miles ÷ 4,800 gal · status PRELIMINARY</div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-content px-5 py-20">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-card border border-line p-7">
              <Inbox size={22} className="text-accent" />
              <h3 className="mt-4 text-xl font-bold">Owner-operators and small fleets</h3>
              <p className="mt-2 text-ink-2">Interstate carriers with 1–10 power units who do the paperwork themselves and would rather drive.</p>
            </div>
            <div className="rounded-card border border-line p-7">
              <BadgeCheck size={22} className="text-accent" />
              <h3 className="mt-4 text-xl font-bold">Bookkeepers and IFTA services</h3>
              <p className="mt-2 text-ink-2">Manage many carriers with clean, traceable paperwork. Partner access is coming after the pilot.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-content px-5 py-20">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent">Pilot pricing</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Priced like software, delivered like a service</h2>
              <p className="mt-3 text-ink-2">Simple monthly plans during the pilot. No contracts. Cancel any time.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.name} className={`rounded-card border bg-canvas p-6 ${p.featured ? "border-accent ring-1 ring-accent" : "border-line"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold">{p.name}</div>
                    <div className="text-xs font-semibold text-ink-3">{p.who}</div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight tnum">{p.price}</span>
                    <span className="text-sm text-ink-2">{p.per}</span>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">{p.note}</p>
                  <LinkButton href="/auth/sign-up" variant={p.featured ? "primary" : "secondary"} className="mt-6 w-full">
                    Get started
                  </LinkButton>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-ink-3">Partner pricing for bookkeepers and service firms is set per company. Ask us.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-content px-5 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Questions</h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-card border border-line p-6">
                <dt className="font-bold">{f.q}</dt>
                <dd className="mt-2 text-sm text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-6 px-5 py-16">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Start now and your quarter is ready before the deadline.</h2>
              <p className="mt-2 text-ink-2">Set up takes ten minutes: your trucks, your drivers, and the first batch of receipts.</p>
            </div>
            <LinkButton href="/auth/sign-up" size="lg" icon={<ArrowRight size={18} />}>
              Create your account
            </LinkButton>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
