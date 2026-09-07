// Movie detail screen (DESIGN.md 3.3) - S-002. Keyed by the movie cuid,
// same absent/unpublished-guard pattern as the Year page (S-001).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovieDetail } from "@/lib/years";
import { Errnote } from "@/components/errnote";

// Same reasoning as the Home and Year pages: must reflect the DB on every
// request (ARCHITECTURE.md 3), no static prerender.
export const dynamic = "force-dynamic";

export default async function MovieDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let movie;
  try {
    movie = await getMovieDetail(params.id);
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Errnote />
      </main>
    );
  }

  // Absent or unpublished movie is simply absent (AC1-AC4), same treatment
  // whether reached by a poster click or a guessed URL.
  if (!movie) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav data-testid="breadcrumb" className="text-sm text-muted">
        <Link href={`/years/${movie.year}`} className="hover:text-ink">
          ← Top 10 · {movie.year}
        </Link>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border border-hairline bg-dark-elev-2">
          {movie.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster}
              alt={`${movie.title} poster`}
              className="h-full w-full object-cover"
              data-testid="movie-poster"
            />
          ) : null}
        </div>

        <div>
          <h1 data-testid="movie-title" className="font-heading text-5xl">
            {movie.title}
          </h1>

          <span
            data-testid="rating-pill"
            className="mt-4 inline-block rounded-sm border border-hairline bg-dark-elev px-3 py-1 font-mono text-sm text-accent-2"
          >
            ★ {movie.rating.toFixed(1)}
          </span>

          <p data-testid="movie-cast" className="mt-4 text-sm text-muted">
            {movie.cast.join(", ")}
          </p>

          <p data-testid="movie-synopsis" className="mt-6 max-w-xl text-ink">
            {movie.synopsis}
          </p>
        </div>
      </div>

      <section
        data-testid="note-card"
        className="mt-10 max-w-2xl rounded-md border border-hairline bg-dark-elev p-6"
      >
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
          Why it made the list
        </h2>
        <p className="mt-3 text-ink">{movie.personalNote}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
          Streaming
        </h2>
        {movie.streamingLinks.length === 0 ? (
          <div
            data-testid="no-streaming-links"
            role="alert"
            className="mt-3 rounded-md border border-hairline bg-dark-elev px-4 py-3 text-sm text-muted"
          >
            No streaming link available yet.
          </div>
        ) : (
          <div data-testid="streaming-links" className="mt-3 flex flex-wrap gap-3">
            {movie.streamingLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-hairline bg-dark-elev px-4 py-2 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-[var(--sh-hover)]"
              >
                {link.provider}
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
