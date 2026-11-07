import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Contracts §6 serves `/v1/...`; the handlers live in `app/api/v1/`.
  async rewrites() {
    return [{ source: '/v1/:path*', destination: '/api/v1/:path*' }];
  },
};

export default nextConfig;
