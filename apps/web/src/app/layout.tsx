import type { Metadata } from 'next';
import { Geist, Geist_Mono, Lexend } from 'next/font/google';
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

const lexend = Lexend({
  variable: '--font-heading',
  subsets: ['latin'],
});

const SITE_NAME = 'Riyaan';
const SITE_DESCRIPTION =
  'Enterprise AI agent platform — guardrails, tool integration, human handoffs, and multi-channel deployment. Built on Gemini, LiveKit & Convex.';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Enterprise AI Agent Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'AI agent platform',
    'enterprise AI',
    'conversational AI',
    'AI guardrails',
    'human handoff',
    'multi-channel AI',
    'customer support AI',
    'AI tool integration',
    'Gemini AI',
    'real-time AI agents',
  ],
  authors: [{ name: 'Rahul Yadav', url: 'https://www.linkedin.com/in/rahulmanuwas' }],
  creator: 'Rahul Yadav',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Enterprise AI Agent Platform`,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Enterprise AI Agent Platform`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL('https://riyaan.xyz'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${lexend.variable} antialiased`}>
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
