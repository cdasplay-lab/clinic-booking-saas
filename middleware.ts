import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register")
  const isDashboard = pathname.startsWith("/dashboard")
  const is2FAChallenge = pathname === "/auth/2fa"

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  if (isLoggedIn) {
    const requiresTwoFactor = !!(req.auth as any)?.requiresTwoFactor
    const twoFactorOk = req.cookies.get("2fa_ok")?.value === req.auth?.user?.id

    if (isAuthPage) {
      if (requiresTwoFactor && !twoFactorOk) {
        return NextResponse.redirect(new URL("/auth/2fa", req.nextUrl))
      }
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
    }

    if (requiresTwoFactor && !twoFactorOk && !is2FAChallenge) {
      return NextResponse.redirect(new URL("/auth/2fa", req.nextUrl))
    }

    if (is2FAChallenge && (!requiresTwoFactor || twoFactorOk)) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
