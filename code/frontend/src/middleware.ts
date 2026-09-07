import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Gates /founder/* per docs/ARCHITECTURE.md section 3: an unauthenticated
// visitor hitting any founder editing route is redirected to the login
// route before the page renders (S-004-AC3), enforced at the route level,
// not by hiding a nav link. /founder/login itself is excluded so the login
// form is reachable. This is UX only, not the authorization boundary; each
// /api/founder/* Route Handler independently re-checks session.role.
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/founder") && pathname !== "/founder/login") {
    if (!req.auth) {
      const loginUrl = new URL("/founder/login", req.nextUrl.origin);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/founder/:path*"],
};
