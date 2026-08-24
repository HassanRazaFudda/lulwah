/** Builds a `?a=1&b=2` query string, dropping `undefined`/`''` entries —
 *  shared by every admin list hook that forwards filters to a `GET`. */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
