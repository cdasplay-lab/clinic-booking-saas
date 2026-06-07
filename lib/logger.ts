import * as Sentry from "@sentry/nextjs"

type Extras = Record<string, unknown>

/**
 * Capture an unexpected error with optional context.
 * Always logs to console too — useful in development where Sentry is disabled.
 */
export function captureError(error: unknown, extras?: Extras): void {
  console.error(error, extras)
  Sentry.withScope((scope) => {
    if (extras) scope.setExtras(extras)
    Sentry.captureException(error)
  })
}

/**
 * Wrap an async API handler to auto-capture unhandled errors.
 * Returns 500 with a generic Arabic message so the user sees something useful.
 */
export function withErrorCapture<T>(
  handler: () => Promise<T>,
  extras?: Extras
): Promise<T> {
  return handler().catch((err) => {
    captureError(err, extras)
    throw err
  })
}
