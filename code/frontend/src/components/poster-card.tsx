// DESIGN.md 3.2: rank badge, title, genre/meta, poster is the whole hit
// target. Movie detail (S-002) is out of this story's scope, so the card
// links to the year page's own movie for now via a data attribute only,
// no href to a route that does not exist yet.
export function PosterCard({
  rank,
  title,
  poster,
  genre,
}: {
  rank: number;
  title: string;
  poster: string;
  genre: string;
}) {
  return (
    <div
      data-testid="poster-card"
      data-rank={rank}
      className="group relative overflow-hidden rounded-md border border-hairline bg-dark-elev shadow-[var(--sh-card)] transition-transform duration-150 ease-[var(--e-standard)] hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[var(--sh-hover)]"
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
    </div>
  );
}
