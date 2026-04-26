import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/sahidfreight-icon.png",
    apple: "/sahidfreight-icon.png",
  },
  title: "Sahid Freight — Move Cargo. Connect East Africa.",
  description: "The fastest way to connect cargo senders with trusted truck owners across Ethiopia, Somalia, and Djibouti.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'light';var l=localStorage.getItem('language')||'en';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('lang',l);})();` }} />
        {children}
      </body>
    </html>
  );
}
