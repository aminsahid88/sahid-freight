import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const POINTS = ["Receipts in, verified records out", "Every number traceable to its receipt", "IFTA worksheet ready for your preparer", "Nothing filed without your approval"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#070b14] p-12 text-white lg:flex">
        <div aria-hidden className="aurora pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#3d7bff]/40 blur-3xl" />
        <div aria-hidden className="aurora pointer-events-none absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-[#8b5cf6]/35 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div aria-hidden className="aurora pointer-events-none absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-[#5be3c4]/25 blur-3xl" style={{ animationDelay: "-12s" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(70%_70%_at_50%_30%,#000,transparent)]" />
        <Link href="/" aria-label="Sahid Freight home" className="relative">
          <Logo light glow size={30} />
        </Link>
        <div className="relative max-w-md">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">Back office · 2026</div>
          <h1 className="text-[42px] font-semibold leading-[1.08] display">
            Your trucking back office, <span className="text-gradient">done for you.</span>
          </h1>
          <ul className="mt-9 space-y-3.5 text-[15px] text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <BadgeCheck size={13} className="text-[#5be3c4]" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">English · Soomaali</p>
      </aside>
      <main className="flex items-start justify-center px-5 py-10 lg:items-center lg:py-16">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Link href="/" aria-label="Sahid Freight home">
              <Logo glow />
            </Link>
          </div>
          <div className="glass hairline-gradient rounded-card p-8 shadow-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
