"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

// Founder login (docs/DESIGN.md 3.7): plain header, single centered card,
// email + password + submit, inline generic error on failure, busy state
// on submit, redirect to /founder/edit on success (S-004-AC1, S-004-AC2).
export default function FounderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setBusy(false);

    if (!result || result.error) {
      // Generic message regardless of cause (unknown email vs wrong
      // password), per S-004-AC2 and ARCHITECTURE.md section 7.
      setError("Incorrect email or password.");
      return;
    }

    router.push("/founder/edit");
  }

  return (
    <main className="flex min-h-screen flex-col bg-dark text-ink">
      <header className="border-b border-hairline px-6 py-4">
        <span className="font-heading text-2xl tracking-wide">
          Movie Info App
        </span>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-hairline bg-dark-elev p-8 shadow-[var(--sh-card)]">
          <h1 className="mb-6 font-heading text-3xl">Founder log in</h1>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="email" className="mb-1 block text-sm text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-md border border-hairline bg-dark px-3 py-2 text-ink outline-none focus:border-accent"
            />

            <label
              htmlFor="password"
              className="mb-1 block text-sm text-muted"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-md border border-hairline bg-dark px-3 py-2 text-ink outline-none focus:border-accent"
            />

            {error ? (
              <p role="alert" className="mb-4 text-sm text-accent">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-white transition-colors duration-150 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
