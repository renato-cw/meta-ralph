import type { Metadata } from 'next';
import { Providers } from '@/contexts';
import { Header } from '@/components/layout';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meta-Ralph UI',
  description: 'Unified Issue Resolution Agent Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)]">
        <Providers>
          <Header />
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
