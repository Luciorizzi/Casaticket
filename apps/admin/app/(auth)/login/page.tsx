import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl rounded-lg border border-[hsl(var(--border))] bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
          Panel administrativo
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-ink">Acceso base</h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-steel">
          Placeholder tecnico para el ingreso del equipo operativo. La autenticacion real quedara
          conectada a Supabase Auth en una fase posterior.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-rust px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a94f35]"
            href="/"
          >
            Ir al dashboard
          </Link>
          <Link
            className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[hsl(var(--accent-soft))]"
            href="/settings"
          >
            Ver configuracion
          </Link>
        </div>
      </section>
    </main>
  );
}

