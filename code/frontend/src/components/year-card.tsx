import Link from "next/link";
import type { PublishedYear } from "@/lib/years";

// DESIGN.md 3.1: year number in display type, movie-count sub-line, whole
// card is the link to the Year page.
export function YearCard({ year }: { year: PublishedYear }) {
  return (
    <Link
      href={`/years/${year.year}`}
      data-testid="year-card"
      className="group block rounded-md border border-hairline bg-dark-elev p-6 shadow-[var(--sh-card)] transition-transform duration-150 ease-[var(--e-standard)] hover:-translate-y-0.5 hover:shadow-[var(--sh-hover)]"
    >
      <div className="font-heading text-5xl leading-none">{year.year}</div>
      <div className="mt-2 text-sm text-muted">
        {year.movieCount} {year.movieCount === 1 ? "movie" : "movies"}
      </div>
    </Link>
  );
}
