import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse, type NextFetchEvent } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY: Azure AD / Entra SSO is BYPASSED. BizHub is an empty framework
// with no vital data yet (Michael's call, 2026-07-25). While this flag is
// false the entire app is open — auth goes back on before real data lands.
//
// TO RE-ENABLE SSO:  set AUTH_ENABLED = true, then rebuild + restart:
//   docker compose -f ~/bizhub/docker-compose.yml up -d --build
// The withAuth wiring below is left fully intact — flipping the flag is the
// only change needed. (Also add the redirect URI to the shared Entra app:
//   https://bizhub.pcc2k.com/api/auth/callback/azure-ad )
// ─────────────────────────────────────────────────────────────────────────
const AUTH_ENABLED = false

// Guard every route except NextAuth callbacks, static assets, and any
// future public portal/webhook paths. Matches DocHub + TicketHub patterns.
// Per `feedback_middleware_matcher.md`: always keep api/cron + api/webhooks
// excluded so scheduled jobs and inbound webhooks don't 307-loop.
const authMiddleware = withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  if (!AUTH_ENABLED) return NextResponse.next()
  return authMiddleware(req, event)
}

export const config = {
  matcher: [
    '/((?!api/auth|api/cron|api/webhooks|auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
