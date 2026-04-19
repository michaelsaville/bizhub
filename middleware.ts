import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Guard every route except NextAuth callbacks, static assets, and any
// future public portal/webhook paths. Matches DocHub + TicketHub patterns.
// Per `feedback_middleware_matcher.md`: always keep api/cron + api/webhooks
// excluded so scheduled jobs and inbound webhooks don't 307-loop.
export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export const config = {
  matcher: [
    '/((?!api/auth|api/cron|api/webhooks|auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
