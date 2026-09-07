// Home / Years screen (DESIGN.md 3.1) - S-001.
import { getPublishedYears } from "@/lib/years";
import { YearCard } from "@/components/year-card";
import { Errnote } from "@/components/errnote";

// Reads must reflect the database on every request (ARCHITECTURE.md 3: "no
// cache to invalidate"), so this page cannot be statically prerendered at
// build time, which would freeze it at whatever the DB held during `next
// build` and never show newly published years without a rebuild.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let years;
  try {
    years = await getPublishedYears();
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Errnote />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent font-heading text-white">
          M
        </div>
        <h1 className="font-heading text-2xl">Movie Info App</h1>
      </header>

      <section className="mt-12">
        <span className="block font-mono text-xs uppercase tracking-widest text-accent-2">
          10 Best Movies · Every Year
        </span>
        <p className="mt-2 max-w-xl text-muted">
          Browse a curated top 10 for each year, picked and written up one
          list at a time.
        </p>
      </section>

      {years.length === 0 ? (
        <div
          data-testid="years-empty"
          className="mt-16 rounded-md border border-hairline bg-dark-elev p-10 text-center text-muted"
        >
          No years published yet. Check back soon.
        </div>
      ) : (
        <div
          data-testid="years-grid"
          className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
        >
          {years.map((year) => (
            <YearCard key={year.id} year={year} />
          ))}
        </div>
      )}
    </main>
  );
}
