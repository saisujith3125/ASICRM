// Production API URL: https://crmapi.asiind.com
// Can be overridden via VITE_API_URL in frontend/.env
export const API_BASE = (import.meta.env.VITE_API_URL || 'https://crmapi.asiind.com').replace(/\/$/, '');

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
