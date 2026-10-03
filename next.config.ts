import type { NextConfig } from 'next';

const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't write AGENTS.md / CLAUDE.md into the repo from `next dev`.
  agentRules: false,
  async headers() {
    return [
      // Content-hashed datasets (scripts/build-data.mjs) and versioned vendor files.
      { source: '/data/:file*', headers: immutable },
      { source: '/vendor/maplibre/:path*', headers: immutable },
      { source: '/vendor/flags/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};

export default nextConfig;
