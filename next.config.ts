import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    // 動的データを表示するページはエッジでキャッシュさせない
    const noCachePaths = [
      '/',
      '/log',
      '/history',
      '/budget',
      '/budget/recurring',
      '/morning',
      '/trend',
      '/plan',
      '/coach',
      '/chat',
      '/research',
      '/onboarding',
    ];
    const headers = [
      {
        key: 'Cache-Control',
        value: 'private, no-store, no-cache, must-revalidate, max-age=0',
      },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];
    return noCachePaths.map((source) => ({ source, headers }));
  },
};

export default nextConfig;
