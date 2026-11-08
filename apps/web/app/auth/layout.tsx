import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const POINTS = ["Receipts in, verified records out", "Every number traceable to its receipt", "IFTA worksheet ready for your preparer", "Nothing filed without your approval"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: "radial-gradient(120% 80% at 0% 0%, #2b5ce6 0%, #15307f 45%, #0b1733 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-10 h-[28rem] w-[28rem] rounded-full bg-[#5be3c4]/10 blur-3xl" />
        <Link href="/" aria-label="Sahid Freight home" className="relative">
          <Logo light />
        </Link>
        <div className="relative max-w-md">
          <h1 className="text-[40px] font-semibold leading-[1.1] display">Your trucking back office, done for you.</h1>
          <ul className="mt-9 space-y-3.5 text-[15px] text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <BadgeCheck size={13} className="text-[#8ff0d8]" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">English · Soomaali</p>
      </aside>
      <main className="flex items-start justify-center px-5 py-10 lg:items-center lg:py-16">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Link href="/" aria-label="Sahid Freight home">
              <Logo />
            </Link>
          </div>
          <div className="rounded-card bg-canvas p-8 shadow-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
