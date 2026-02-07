import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/layout/shell';
import { SessionProvider } from '@/lib/hooks/use-session';

export const metadata: Metadata = {
  title: 'GenAI Voice Dashboard',
  description: 'Admin dashboard for GenAI Voice platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
