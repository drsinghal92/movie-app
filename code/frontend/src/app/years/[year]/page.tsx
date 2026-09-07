// Year detail screen (DESIGN.md 3.2) - S-001. Keyed by the integer year
// value in the URL (/years/1994), not the cuid id, per the story's Plan.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getYearWithMovies } from "@/lib/years";
import { PosterCard } from "@/components/poster-card";
import { Errnote } from "@/components/errnote";

// Same reasoning as the Home page: must reflect the DB on every request.
export const dynamic = "force-dynamic";

export default async function YearPage({
  params,
}: {
  params: { year: string };
}) {
  const yearNum = Number(params.year);

  if (!Number.isInteger(yearNum)) {
    notFound();
  }

  let data;
  try {
    data = await getYearWithMovies(yearNum);
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Errnote />
      </main>
    );
  }

  // Unpublished or absent years are simply absent (S-001-AC3), same
  // treatment whether reached by nav or by a guessed URL.
  if (!data) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav data-testid="breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          ← All years
        </Link>
      </nav>

      <h1 className="mt-6 font-heading text-5xl">Top 10 · {data.year}</h1>

      <div
        data-testid="movie-grid"
        className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
      >
        {data.movies.map((movie) => (
          <PosterCard
            key={movie.id}
            id={movie.id}
            rank={movie.rank}
            title={movie.title}
            poster={movie.poster}
            genre={movie.genre}
          />
        ))}
      </div>
    </main>
  );
}
