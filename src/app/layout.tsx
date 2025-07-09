import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { AudioPlayerProvider } from '@/hooks/useAudioPlayer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RadioMap - Discover Radio Stations Worldwide',
  description: 'Explore and listen to radio stations from around the world with our interactive map and comprehensive station directory.',
  keywords: 'radio, map, stations, worldwide, music, news, streaming',
  authors: [{ name: 'RadioMap Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AudioPlayerProvider>
          {children}
        </AudioPlayerProvider>
      </body>
    </html>
  );
} 