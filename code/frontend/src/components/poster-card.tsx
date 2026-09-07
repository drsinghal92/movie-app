// DESIGN.md 3.2: rank badge, title, genre/meta, poster is the whole hit
// target, linking to the movie's detail page (S-002).
import Link from "next/link";

export function PosterCard({
  id,
  rank,
  title,
  poster,
  genre,
}: {
  id: string;
  rank: number;
  title: string;
  poster: string;
  genre: string;
}) {
  return (
    <Link
      href={`/movies/${id}`}
      data-testid="poster-card"
      data-rank={rank}
      className="group relative block overflow-hidden rounded-md border border-hairline bg-dark-elev shadow-[var(--sh-card)] transition-transform duration-150 ease-[var(--e-standard)] hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[var(--sh-hover)]"
    >
      <div className="relative aspect-[2/3] w-full bg-dark-elev-2">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={`${title} poster`}
            className="h-full w-full object-cover"
          />
        ) : null}
        <span className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-1 font-heading text-sm text-white">
          {rank}
        </span>
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted">{genre}</div>
      </div>
    </Link>
  );
}
