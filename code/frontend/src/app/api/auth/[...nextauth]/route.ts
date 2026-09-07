import { handlers } from "@/lib/auth";

// Mounts Auth.js's own route handlers (signin, callback, session, etc.)
// under /api/auth/*, per docs/ARCHITECTURE.md section 3 (system design).
export const { GET, POST } = handlers;
