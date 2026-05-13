import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "www.tst-plotconnect.com";
const LEGACY_HOSTS = new Set(["tstplotconnect.vercel.app", "tst-plotconnect.vercel.app"]);

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const host = nextUrl.hostname.toLowerCase();

  if (LEGACY_HOSTS.has(host)) {
    const redirectUrl = new URL(nextUrl.pathname + nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(redirectUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
