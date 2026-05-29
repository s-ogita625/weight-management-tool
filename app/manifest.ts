import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '体重管理ツール',
    short_name: '食事管理',
    description:
      '体重・体脂肪率・食事・PFC・筋トレを管理するボディメイク支援ツール',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#070a0f',
    theme_color: '#070a0f',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
