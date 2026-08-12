/**
 * Reads the CSRF token from the bk_csrf cookie. This cookie is deliberately
 * not httpOnly -- the server issues it alongside the session cookie
 * specifically so the frontend can read it here and echo it back as a
 * header. A cross-site attacker's page can't read this cookie (browsers
 * scope document.cookie to the origin that set it), so it can't forge the
 * matching header even though the session cookie itself rides along
 * automatically with cross-site requests.
 */
export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bk_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Drop-in replacement for fetch() that attaches X-CSRF-Token on every
 * non-GET request. Use this for any request that creates, updates, or
 * deletes data; plain fetch() is still fine for simple GETs.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return fetch(url, options);
  }
  const headers = new Headers(options.headers || {});
  const token = getCsrfToken();
  if (token) {
    headers.set('X-CSRF-Token', token);
  }
  return fetch(url, { ...options, headers });
}
