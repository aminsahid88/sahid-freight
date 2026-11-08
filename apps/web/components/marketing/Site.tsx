import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-line">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5">
        <Link href="/" aria-label="Sahid Freight home">
          <Logo glow />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex" aria-label="Main">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#ifta" className="hover:text-ink">IFTA</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/auth/sign-in" variant="ghost" size="sm">
            Sign in
          </LinkButton>
          <LinkButton href="/auth/sign-up" size="sm">
            Get started
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-content gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-[13px] text-ink-2">
            Back-office service for small U.S. trucking carriers. Receipts in, clean books and IFTA-ready numbers out.
          </p>
          <p className="mt-3 text-xs text-ink-3">
            Prepared for review by a qualified preparer. Sahid Freight is not a filing service and does not provide tax advice.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Product</div>
          <ul className="space-y-2 text-ink-2">
            <li><a href="#how" className="hover:text-ink">How it works</a></li>
            <li><a href="#ifta" className="hover:text-ink">IFTA quarters</a></li>
            <li><a href="#pricing" className="hover:text-ink">Pricing</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Company</div>
          <ul className="space-y-2 text-ink-2">
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><a href="mailto:hello@sahidfreight.com" className="hover:text-ink">hello@sahidfreight.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-ink-3">
          <span>© {new Date().getFullYear()} Sahid Freight</span>
          <span>English · Soomaali</span>
        </div>
      </div>
    </footer>
  );
}
