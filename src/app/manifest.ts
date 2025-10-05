import {MetadataRoute} from 'next';

export default function Manifest(): MetadataRoute.Manifest {
  return {
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-256x256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    background_color: '#F8F6F2',
    description: 'Flow State App',
    display: 'standalone',
    name: 'Flow State',
    scope: '/',
    short_name: 'Flow State',
    start_url: '/',
    theme_color: '#F8F6F2',
  };
}
