import { preload } from 'react-dom';
import manifest from '@/data/manifest.json';
import ClientApp from './client-app';

export default function Page() {
  // The globe needs the (small) places file first; start it before any JS runs.
  preload(manifest.files.places, { as: 'fetch', crossOrigin: 'anonymous' });
  return <ClientApp />;
}
