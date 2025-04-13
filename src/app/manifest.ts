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
      background_color: '#F8F6F2',
      description: 'Flow State App',
      display: 'standalone',
      name: 'Flow State',
      scope: '/',
      short_name: 'Flow State',
      start_url: '/',
      theme_color: '#F8F6F2',
    },
  };
}
