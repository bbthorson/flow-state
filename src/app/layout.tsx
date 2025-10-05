import type {Metadata} from 'next';
import {Nunito_Sans, Geist_Mono} from 'next/font/google';
import './globals.css';

const nunitoSans = Nunito_Sans({
  variable: '--font-nunito-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400'],
});

export const metadata: Metadata = {
  description: 'Flow State App',
  manifest: '/manifest.json',
  themeColor: '#F8F6F2',
  title: 'Flow State',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

import {Toaster} from '@/components/ui/toaster';
