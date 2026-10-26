import './globals.css';
import Providers from './providers';

import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: 'syntgrid | Compare your calendars',
  description: 'Upload, edit, and compare personal timetable calendars',
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