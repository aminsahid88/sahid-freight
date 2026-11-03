import { SiteFooter, SiteHeader } from "@/components/marketing/Site";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14 prose-sm">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
