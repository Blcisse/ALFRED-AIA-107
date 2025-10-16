// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/favicon.ico",
  "/background2.jpg",
  "/alfredlogo.png",
  "/_next",
  "/assets",
];

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session_user")?.value;

  // If user is NOT logged in and route is protected -> redirect to login
  if (!session && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // If user IS logged in and visits auth pages, send them home
  if (session && pathname.startsWith("/auth")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/.*|_next/.*|.*\\..*).*)", "/api/auth/:path*"],
};
