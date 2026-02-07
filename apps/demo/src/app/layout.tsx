import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'genai-voice Demo',
  description: 'Demo app for @genai-voice packages',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
