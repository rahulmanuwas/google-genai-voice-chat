import Link from 'next/link';

export function CTAFooter() {
  return (
    <>
      {/* CTA */}
      <section className="py-24 sm:py-32 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Ready to give your product a voice?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Start building with the dashboard, explore the demos, or dive into the API docs.
          </p>
          <Link
            href="/overview"
            className="inline-flex items-center justify-center rounded-lg bg-[hsl(200_80%_55%)] px-10 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(200_80%_55%/0.25)] transition-all hover:shadow-[hsl(200_80%_55%/0.4)] hover:brightness-110"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium tracking-tight text-muted-foreground">
            <span className="text-[hsl(200_80%_55%)]">.</span>Riyaan
          </span>
          <p className="text-xs text-muted-foreground">
            AI voice agent platform — built with Gemini, LiveKit &amp; Convex
          </p>
        </div>
      </footer>
    </>
  );
}
