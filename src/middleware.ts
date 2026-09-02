import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * Gate the pages on the presence of a session cookie. This is a cheap check --
 * the API routes still validate the session properly on every request.
 */
export function middleware(request: NextRequest) {
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login";

  if (!hasCookie && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasCookie && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/activities/:path*", "/login"],
};
