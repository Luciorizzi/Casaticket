'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';

import { adminModuleLinks } from '@casaticket/ui';

import { cn } from '@/lib/utils';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 md:grid-cols-[260px_minmax(0,1fr)] md:px-6">
        <aside className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(255,255,255,0.72)] p-4 shadow-sm backdrop-blur">
          <div className="rounded-md bg-[hsl(var(--accent-soft))] p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-rust/90 p-2 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
                  CasaTicket
                </p>
                <h1 className="text-lg font-semibold text-ink">Admin skeleton</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-steel">
              Base operativa para moderacion, validacion y configuracion futura.
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {adminModuleLinks.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={cn(
                    'block rounded-md border px-3 py-3 transition',
                    active
                      ? 'border-rust bg-white text-ink shadow-sm'
                      : 'border-transparent text-steel hover:border-[hsl(var(--border))] hover:bg-white/80',
                  )}
                  href={item.href}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </div>
                  <p className="mt-1 text-sm leading-5">{item.description}</p>
                </Link>
              );
            })}
          </nav>

          <Link
            className="mt-6 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm font-semibold text-steel transition hover:bg-white/80"
            href="/login"
          >
            <Settings className="h-4 w-4" />
            Acceso placeholder
          </Link>
        </aside>

        <main className="rounded-lg border border-[hsl(var(--border))] bg-white/72 p-6 shadow-sm backdrop-blur md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

