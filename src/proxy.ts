import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/config";

/**
 * Optimistic routing only: reads the session JWT, never the database.
 * Real authorization happens in the server (requireUser / assertTripAccess).
 */
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/trips", "/settings", "/onboarding", "/admin"];
const AUTH_PAGES = ["/login", "/signup"];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);

  if (!isLoggedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", request.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/trips/:path*", "/settings/:path*", "/onboarding/:path*", "/admin/:path*", "/login", "/signup"],
};
