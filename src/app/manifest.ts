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
      description: 'Do Not Disturb App',
      display: 'standalone',
      name: 'Do Not Disturb',
      scope: '/',
      short_name: 'Do Not Disturb',
      start_url: '/',
      theme_color: '#000000',
    },
  };
}
