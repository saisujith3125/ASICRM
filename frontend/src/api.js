// Production API URL: https://crmapi.asiind.com
// Can be overridden via VITE_API_URL in frontend/.env
export const API_BASE = (import.meta.env.VITE_API_URL || 'https://crmapi.asiind.com').replace(/\/$/, '');

export const apiUrl = (path = '') => {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalised}`;
};

/**
 * Safely parse JSON responses from fetch.
 * Prevents syntax error crashes (e.g. "<!DOCTYPE html> is not valid JSON")
 * when reverse proxies (Nginx/IIS/Cloudflare) return HTML 4xx/5xx error pages.
 */
export const safeJson = async (res) => {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        message: text || `HTTP ${res.status}: ${res.statusText || 'Unexpected error'}`
      };
    }
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Network response error'
    };
  }
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
