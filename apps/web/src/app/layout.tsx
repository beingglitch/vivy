import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Martian_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * The canvas pairs Instrument Sans for interface text with Martian Mono for
 * anything numeric. amounts, counts, times, the clock. Loaded through
 * `next/font` so they are self-hosted and swap without a layout shift, rather
 * than fetched from Google at runtime.
 */
const sans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument',
  display: 'swap',
});

const mono = Martian_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-martian',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vivy',
  description: 'Personal life tracker',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Vivy', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
