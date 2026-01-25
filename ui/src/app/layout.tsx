import type { Metadata } from 'next';
import { Providers } from '@/contexts';
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
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)]">
        <Providers>
          <header className="border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">
                Meta-Ralph
              </h1>
              <span className="text-sm text-[var(--muted)]">
                Unified Issue Resolution Agent
              </span>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
