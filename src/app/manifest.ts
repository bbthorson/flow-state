import {MetadataRoute} from 'next/server';

export default function Manifest(): MetadataRoute {
  return {
    icons: [
      {
        sizes: 'any',
        src: '/icon.png',
        type: 'image/png',
      },
    ],
    manifest: {
      background_color: '#F0F0F0',
      description: 'PWA State Tracker',
      display: 'standalone',
      name: 'PWA State Tracker',
      scope: '/',
      short_name: 'PWA Tracker',
      start_url: '/',
      theme_color: '#008080',
    },
  };
}
