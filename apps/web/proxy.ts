/**
 * Legacy marketplace routes are archived behind NEXT_PUBLIC_LEGACY_MARKETPLACE
 * (default "true" until Amin approves switching the marketplace off). When off,
 * the old dashboard/driver/tracking/admin-marketplace pages redirect to the
 * back-office. Files stay in place for Phase 3 reuse.
 */
import { NextResponse, type NextRequest } from "next/server";

const LEGACY_ON = (process.env.NEXT_PUBLIC_LEGACY_MARKETPLACE ?? "true").trim().toLowerCase() !== "false";

const LEGACY_PREFIXES = ["/dashboard", "/driver", "/tracking", "/admin/loads", "/admin/bookings", "/admin/trucks"];

export default function proxy(request: NextRequest) {
  if (LEGACY_ON) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (LEGACY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/office";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/driver/:path*", "/tracking/:path*", "/admin/loads/:path*", "/admin/bookings/:path*", "/admin/trucks/:path*"],
};
