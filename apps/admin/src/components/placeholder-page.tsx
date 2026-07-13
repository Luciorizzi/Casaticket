interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  bullets,
}: PlaceholderPageProps) {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-semibold text-ink">{title}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-steel">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {bullets.map((item) => (
          <article
            key={item}
            className="min-h-36 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--accent-soft))]/45 p-4"
          >
            <p className="text-sm font-medium leading-6 text-ink">{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

