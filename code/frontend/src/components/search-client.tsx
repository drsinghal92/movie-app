"use client";

// Client search surface (DESIGN.md 3.4) - S-003. Autofocused text input plus
// two recognition-over-recall `select` dropdowns, live-querying
// GET /api/movies as the visitor types/filters (no submit button, per
// DESIGN's one-primary-action note: typing is the action).
import { useEffect, useState } from "react";
import { PosterCard } from "@/components/poster-card";
import { Errnote } from "@/components/errnote";

type SearchResult = {
  id: string;
  rank: number;
  title: string;
  poster: string;
  genre: string;
  year: number;
};

export function SearchClient({
  years,
  genres,
}: {
  years: number[];
  genres: string[];
}) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (year) params.set("year", year);
    if (genre) params.set("genre", genre);

    setLoading(true);
    setError(false);

    const timer = setTimeout(() => {
      fetch(`/api/movies?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error("search failed");
          const data = await res.json();
          setResults(data.movies);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setError(true);
          setResults(null);
        })
        .finally(() => setLoading(false));
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, year, genre]);

  return (
    <div className="mt-10">
      <input
        data-testid="search-input"
        type="text"
        autoFocus
        placeholder="Search by title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-md border border-hairline bg-dark-elev px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="mt-4 flex gap-3">
        <select
          data-testid="year-filter"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-md border border-hairline bg-dark-elev px-3 py-2 text-sm"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          data-testid="genre-filter"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="rounded-md border border-hairline bg-dark-elev px-3 py-2 text-sm"
        >
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-10">
        {error ? (
          <Errnote />
        ) : loading ? (
          <div
            data-testid="search-loading"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-full animate-pulse rounded-md bg-dark-elev-2"
              />
            ))}
          </div>
        ) : results && results.length === 0 ? (
          <div
            data-testid="search-empty"
            className="rounded-md border border-hairline bg-dark-elev p-10 text-center text-muted"
          >
            No movies match your search.
          </div>
        ) : results ? (
          <div
            data-testid="search-results"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
          >
            {results.map((movie) => (
              <PosterCard
                key={movie.id}
                rank={movie.rank}
                title={movie.title}
                poster={movie.poster}
                genre={movie.genre}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
