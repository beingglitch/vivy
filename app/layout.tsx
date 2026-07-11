import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Her voice — a soft, warm serif. UI stays in a quiet sans; numbers in mono.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivy",
  description: "My personal AI assistant",
  appleWebApp: { capable: true, title: "Vivy", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#141218",
};

const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/tasks", label: "Tasks" },
  { href: "/learning", label: "Learning" },
  { href: "/finance", label: "Finance" },
  { href: "/browsing", label: "Browsing" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-seam/70">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="flex items-center gap-2">
              <span className="presence h-2 w-2 rounded-full bg-ember" aria-hidden />
              <span className="font-voice text-lg italic tracking-wide text-linen">Vivy</span>
            </Link>
            <div className="flex gap-5 pt-0.5">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-moth transition-colors hover:text-linen"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
