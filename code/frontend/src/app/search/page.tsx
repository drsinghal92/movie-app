// Search screen (DESIGN.md 3.4) - S-003. Server Component loads the filter
// options once (real published years/genres, recognition over recall) then
// hands off to the client search surface, which owns the live-filter query
// per docs/ARCHITECTURE.md section 3.
import { getSearchFilters } from "@/lib/movies";
import { SearchClient } from "@/components/search-client";
import { Errnote } from "@/components/errnote";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  let filters;
  try {
    filters = await getSearchFilters();
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Errnote />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-heading text-3xl">Search</h1>
      <SearchClient years={filters.years} genres={filters.genres} />
    </main>
  );
}
