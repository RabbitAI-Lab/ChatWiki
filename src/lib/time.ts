/**
 * Returns an ISO timestamp for `daysAgo` days before now.
 * Extracted so Server Components call a utility function
 * rather than `Date.now()` directly during render.
 */
export function getRecentCutoff(daysAgo = 20): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}
