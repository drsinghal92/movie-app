// Shared inline error block (DESIGN.md 3.1/3.2 "errnote"). Server Components
// that hit a Prisma error render this rather than throwing to a blank Next.js
// error page, per docs/ARCHITECTURE.md section 5 error handling convention.
export function Errnote({ message = "Something went wrong, retry." }: { message?: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-hairline bg-dark-elev px-4 py-3 text-sm text-muted"
    >
      {message}
    </div>
  );
}
