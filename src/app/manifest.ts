import {MetadataRoute} from 'next';

export default function Manifest(): MetadataRoute.Manifest {
  return {
    icons: [
      {
        sizes: 'any',
        src: '/favicon.ico',
        type: 'image/x-icon',
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
