import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const POINTS = ["Receipts in, verified records out", "Every number traceable to its receipt", "IFTA worksheet ready for your preparer", "Nothing filed without your approval"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <Link href="/" aria-label="Sahid Freight home">
          <Logo light />
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Your trucking back office, done for you.</h1>
          <ul className="mt-8 space-y-3 text-[15px] text-[#C7D2E6]">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#5BE3C4]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[#9BB8FF]">English · Soomaali</p>
      </aside>
      <main className="flex items-start justify-center px-5 py-10 lg:items-center lg:py-16">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Link href="/" aria-label="Sahid Freight home">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
