'use client';

import { AppProvider } from './AppContext';
import { ThemeProvider } from './ThemeContext';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for the application.
 * Use this component in layout.tsx to wrap all providers.
 *
 * Provider order (outermost to innermost):
 * 1. ThemeProvider - Manages theme state and applies theme class to document
 * 2. AppProvider - Manages application state (issues, filters, etc.)
 *
 * @example
 * // In layout.tsx (Server Component)
 * import { Providers } from '@/contexts/Providers';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <Providers>{children}</Providers>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </ThemeProvider>
  );
}
