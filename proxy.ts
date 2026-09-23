import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route guard for the staff and admin areas.
 *
 * Next.js 16 renamed Middleware to Proxy; a file named `middleware.ts` is
 * silently ignored here.
 *
 * This is an *optimistic* check — it only looks for a session cookie, which
 * is cheap and keeps signed-out users off the screens entirely. It is not the
 * authorization boundary: every page and route handler under /admin and
 * /staff re-checks the real session and role on the server, because a cookie
 * can be forged but a verified session cannot.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession) {
    const signIn = new URL("/signin", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
