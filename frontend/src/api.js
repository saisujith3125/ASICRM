// Prefer IPv4 loopback. `localhost` can resolve to ::1 while Vite/Express
// bind on different stacks, which shows up in the UI as a port-5000 outage.
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

export const apiUrl = (path = '') => {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalised}`;
};


/**
 * Authenticated API wrapper for protected CRM endpoints.
 * The server resolves the real user/role from this stored user id.
 * Existing explicit headers are preserved for backward compatibility.
 */
export const apiFetch = async (input, options = {}) => {
  const headers = new Headers(options.headers || {});
  try {
    const saved = localStorage.getItem('asicrm_user');
    if (saved) {
      const sessionUser = JSON.parse(saved);
      if (sessionUser?.id && !headers.has('x-user-id')) {
        headers.set('x-user-id', String(sessionUser.id));
      }
    }
  } catch {
    // Ignore malformed local session; the backend will reject protected requests.
  }

  return fetch(input, {
    ...options,
    headers
  });
};
