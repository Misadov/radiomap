import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import manifest from '@/data/manifest.json';
import './globals.css';

const stations = manifest.stations.toLocaleString('en');
const description = `Spin the globe and tune into ${stations} live radio stations from ${manifest.countries} countries — free, no sign-up.`;

export const metadata: Metadata = {
  metadataBase: new URL('https://radiomap.vercel.app'),
  title: 'RadioMap — live radio from every corner of the planet',
  description,
  applicationName: 'RadioMap',
  keywords: ['radio', 'internet radio', 'live radio', 'world radio', 'radio map', 'globe', 'stations'],
  openGraph: {
    type: 'website',
    siteName: 'RadioMap',
    title: 'RadioMap — live radio from every corner of the planet',
    description,
  },
  twitter: { card: 'summary_large_image', title: 'RadioMap', description },
  appleWebApp: { capable: true, title: 'RadioMap', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#04050a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
