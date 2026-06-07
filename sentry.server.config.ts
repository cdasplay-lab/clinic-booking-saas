import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  // Don't send PII to Sentry
  beforeSend(event) {
    // Strip request body from events (may contain financial data)
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
    }
    return event
  },
})
