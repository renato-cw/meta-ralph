'use client';

import { AppProvider } from './AppContext';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for the application.
 * Use this component in layout.tsx to wrap all providers.
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
    <AppProvider>
      {children}
    </AppProvider>
  );
}
