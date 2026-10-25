import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'SyncGrid | Real-Time Calendar Sync',
  description: 'Sync and compare Outlook timetables side by side',
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