import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Fraunces, Instrument_Sans, Geist_Mono } from 'next/font/google';
import { VivyFab } from './vivy-fab';
import { MobileTabs } from './mobile-tabs';
import { NotificationsBell } from './notifications-bell';
import './globals.css';

// Her voice — a soft, warm serif. UI stays in a quiet sans; numbers in mono.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Vivy',
  description: 'My personal AI assistant',
  appleWebApp: { capable: true, title: 'Vivy', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#141218',
};

const nav = [
  { href: '/chat', label: 'Chat' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/learning', label: 'Learning' },
  { href: '/finance', label: 'Finance' },
  { href: '/browsing', label: 'Browsing' },
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
          {/* Phones navigate with the bottom tab bar; the top row keeps just the
              wordmark and settings. Full link row appears from sm up. */}
          <nav className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-3 text-sm sm:gap-6 lg:max-w-6xl">
            <Link href="/" className="flex items-center gap-2">
              <span className="presence h-2 w-2 rounded-full bg-ember" aria-hidden />
              <span className="font-voice text-lg italic tracking-wide text-linen">Vivy</span>
            </Link>
            <div className="hidden gap-5 pt-0.5 sm:flex">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-moth transition-colors hover:text-linen">
                  {n.label}
                </Link>
              ))}
            </div>
            <span className="ml-auto flex items-center gap-4">
              <NotificationsBell />
            </span>
            <Link href="/settings" title="Settings" className="text-moth transition-colors hover:text-linen">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-4.5 w-4.5"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M12 3.5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.6-6.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </nav>
        </header>
        {/* Phones read a single column; large screens get a real desktop canvas. */}
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-36 sm:pb-24 lg:max-w-6xl lg:px-6">
          {children}
        </div>
        <VivyFab />
        <MobileTabs />
      </body>
    </html>
  );
}
