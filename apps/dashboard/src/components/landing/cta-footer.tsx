import Link from 'next/link';

export function CTAFooter() {
  return (
    <>
      {/* CTA */}
      <section className="py-16 sm:py-24 lg:py-32 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
            Ready to deploy AI that works?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Explore the dashboard, try live demos, or dive into the API docs.
          </p>
          <Link
            href="/overview"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-10 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-center sm:text-left">
          <span className="text-sm font-medium tracking-tight text-muted-foreground">
            <span className="text-[hsl(200_80%_55%)]">.</span>Riyaan
          </span>
          <p className="text-xs text-muted-foreground">
            Enterprise AI platform — built with Gemini, LiveKit &amp; Convex
          </p>
        </div>
      </footer>
    </>
  );
}
