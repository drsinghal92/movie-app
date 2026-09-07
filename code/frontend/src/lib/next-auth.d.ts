import type { DefaultSession } from "next-auth";

// Module augmentation adding `role` to the session/user/JWT shapes, so
// `session.user.role === 'FOUNDER'` type-checks at every call site
// (src/lib/auth.ts, middleware.ts, founder/edit/page.tsx).
declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
