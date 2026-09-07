import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "./db";

// Auth.js (NextAuth v5) instance, per docs/ARCHITECTURE.md section 3
// ("Auth approach"). One Credentials provider serves both the founder
// (S-004) and visitor (S-006) audiences, distinguished by `role` on the
// JWT/session claims. JWT session strategy, no session table.
//
// Security notes (ARCHITECTURE.md section 7):
// - Passwords are hashed with bcrypt, never stored or logged plain.
// - Any bad credential (unknown email OR wrong password) throws the same
//   generic error, so the response never leaks whether an email exists
//   (S-004-AC2, S-006-AC3).
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Playwright's webServer runs `next start` behind a plain http://localhost
  // origin (no reverse proxy setting a trusted forwarded host), which
  // Auth.js v5 otherwise rejects as an UntrustedHost. Fine at this tier
  // (single deployable, no proxy in front per ARCHITECTURE.md decision 1).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/founder/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // Same generic error as a wrong password, never "email not found".
          throw new Error("Invalid credentials");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          throw new Error("Invalid credentials");
        }

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as
          | string
          | undefined;
      }
      return session;
    },
  },
});
