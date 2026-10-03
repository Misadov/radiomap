import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RadioMap — live radio from every corner of the planet',
    short_name: 'RadioMap',
    description: 'Spin the globe and tune into live radio stations from all over the world.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04050a',
    theme_color: '#04050a',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
