import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Minimal FOUNDER-only placeholder (docs/DESIGN.md 3.8 lands the real tool
// in S-005). This page's job for S-004 is just the authorization boundary:
// server-side re-check of session.role === 'FOUNDER' (ARCHITECTURE.md
// section 7 - middleware alone is UX, not the security boundary), plus a
// visible destination for AC1 to redirect to on successful login.
export default async function FounderEditPage() {
  const session = await auth();

  if (!session || session.user?.role !== "FOUNDER") {
    redirect("/founder/login");
  }

  return (
    <main className="min-h-screen bg-dark px-6 py-10 text-ink">
      <header className="mb-8 flex items-center justify-between border-b border-hairline pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-faint">
          Editing
        </span>
        <span className="text-sm text-muted">{session.user?.email}</span>
      </header>
      <h1 className="font-heading text-3xl">Founder tool</h1>
      <p className="mt-2 max-w-prose text-muted">
        Year and movie curation lands in S-005. This placeholder proves the
        founder-only gate.
      </p>
    </main>
  );
}
