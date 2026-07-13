import type { Metadata } from 'next';

import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'CasaTicket Admin',
  description: 'Panel administrativo base para CasaTicket.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

