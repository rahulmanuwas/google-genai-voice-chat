import { Shell } from '@/components/layout/shell';
import { SessionProvider } from '@/lib/hooks/use-session';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
