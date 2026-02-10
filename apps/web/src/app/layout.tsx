import type { Metadata } from 'next';
import { Geist, Geist_Mono, Asul } from 'next/font/google';
import { FirebaseAnalytics } from '@/components/analytics';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

const asul = Asul({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Riyaan',
  description: 'AI voice agent platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${asul.variable} antialiased`}>
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
