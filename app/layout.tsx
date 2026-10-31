import './globals.css';
import Providers from './providers';

import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: 'SyntGrid',
  description: 'Upload, edit, and compare personal timetable calendars',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SyntGrid',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#121212] text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}