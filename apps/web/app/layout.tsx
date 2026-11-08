import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://sahidfreight.com"),
  title: {
    default: "Sahid Freight — Trucking back office, done for you",
    template: "%s · Sahid Freight",
  },
  description:
    "Send us your paperwork. Every month you get clean books and IFTA-ready numbers, checked by AI and confirmed by a person, with every number traceable to its receipt.",
  applicationName: "Sahid Freight",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sahid Freight" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
  viewportFit: "cover",
};

// Applies the saved theme (else the system preference) and language before first paint (no flash). Static string: safe.
const bootstrap = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var l='en';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('lang',l);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-surface text-ink`}>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
        <div className="ambient" aria-hidden />
        {children}
      </body>
    </html>
  );
}
