// Production API URL: https://crmapi.asiind.com
// Development API URL: http://127.0.0.1:5000
export const API_BASE = (() => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:5000';
    }
  }
  return 'https://crmapi.asiind.com';
})();

export const apiUrl = (path = '') => {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalised}`;
};

/**
 * Clean up error messages when backend / reverse proxy returns plain text or HTML.
 */
function extractUserFriendlyError(text, res) {
  const trimmed = (text || '').trim();
  const lower = trimmed.toLowerCase();

  // If text is "Bad Request" or starts with "bad request"
  if (lower === 'bad request' || lower.startsWith('bad request')) {
    return 'Invalid request data. Please verify your entries and required fields.';
  }

  // If response is an HTML page (<!DOCTYPE or <html...)
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    if (res?.status === 400) return 'The server rejected the request as invalid (HTTP 400). Please check the entered data.';
    if (res?.status === 401 || res?.status === 403) return 'You do not have permission to perform this action.';
    if (res?.status === 404) return 'The requested resource was not found on the server.';
    if (res?.status === 502 || res?.status === 503 || res?.status === 504) {
      return 'The CRM server is temporarily busy or unreachable. Please try again shortly.';
    }
    if (res?.status >= 500) {
      return 'The server encountered an error processing your request. Please try again.';
    }
    return `Server returned status ${res?.status || 500}.`;
  }

  // If response is a short plain text message (under 200 chars and no html)
  if (trimmed.length > 0 && trimmed.length < 200 && !trimmed.includes('<')) {
    return trimmed;
  }

  // Fallback to HTTP status text
  if (res?.statusText) {
    return `${res.statusText} (HTTP ${res.status})`;
  }

  return 'Server returned an invalid or unrecognized response.';
}

/**
 * Safely parse JSON responses from fetch.
 * Prevents syntax error crashes (e.g. "Unexpected token 'B', 'Bad Request' is not valid JSON")
 * when reverse proxies (Nginx/IIS/Cloudflare) return non-JSON 4xx/5xx error pages or plain text.
 */
export const safeJson = async (resOrText, optionalRes = null) => {
  try {
    let text = '';
    let res = optionalRes;
    if (typeof resOrText === 'string') {
      text = resOrText;
    } else if (resOrText && typeof resOrText.text === 'function') {
      res = resOrText;
      text = await resOrText.text();
    } else if (resOrText && typeof resOrText === 'object') {
      return resOrText;
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (res && res.ok === false && parsed.success === undefined) {
          parsed.success = false;
        }
        return parsed;
      }
    } catch {
      // JSON parsing failed, construct clean user-friendly error object
    }

    const cleanMessage = extractUserFriendlyError(text, res);
    return {
      success: false,
      message: cleanMessage,
      error: cleanMessage,
      status: res?.status || 0
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Network response error',
      error: err.message || 'Network response error',
      status: optionalRes?.status || 0
    };
  }
};

/**
 * Wrap a Response instance so that:
 * 1. res.json() uses safeJson and never throws SyntaxError: Unexpected token ... is not valid JSON.
 * 2. res.text() can be read multiple times safely without "body stream already read" errors.
 * 3. res.safeJson() is available directly on the response.
 */
export const wrapResponse = (res) => {
  if (!res || typeof res !== 'object') return res;

  let cachedText = null;
  const originalText = typeof res.text === 'function' ? res.text.bind(res) : async () => '';

  const safeGetText = async () => {
    if (cachedText === null) {
      try {
        cachedText = await originalText();
      } catch {
        cachedText = '';
      }
    }
    return cachedText;
  };

  res.text = safeGetText;
  res.safeJson = async () => {
    const text = await safeGetText();
    return safeJson(text, res);
  };
  res.json = async () => {
    const text = await safeGetText();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (res.ok === false && parsed.success === undefined) {
          parsed.success = false;
        }
        return parsed;
      }
    } catch {
      // Non-JSON fallback
    }
    const cleanMessage = extractUserFriendlyError(text, res);
    return {
      success: false,
      message: cleanMessage,
      error: cleanMessage,
      status: res.status
    };
  };

  return res;
};

/**
 * Authenticated API wrapper for protected CRM endpoints.
 * Automatically injects authentication headers and wraps responses
 * to prevent JSON parse crashes anywhere in the application.
 */
export const apiFetch = async (input, options = {}) => {
  const headers = new Headers(options.headers || {});
  try {
    const saved = localStorage.getItem('asicrm_user');
    if (saved) {
      const sessionUser = JSON.parse(saved);
      const currentUserId = headers.get('x-user-id');
      if (sessionUser?.id && (!currentUserId || currentUserId.trim() === '')) {
        headers.set('x-user-id', String(sessionUser.id));
      }
      if (sessionUser?.mobile && !headers.has('x-user-mobile')) {
        headers.set('x-user-mobile', String(sessionUser.mobile));
      }
      if (sessionUser?.email && !headers.has('x-user-email')) {
        headers.set('x-user-email', String(sessionUser.email));
      }
    }
  } catch {
    // Ignore malformed local session; the backend will reject protected requests.
  }

  // Ensure default fallback x-user-id if none provided
  const resolvedUserId = headers.get('x-user-id');
  if (!resolvedUserId || resolvedUserId.trim() === '') {
    headers.set('x-user-id', 'USR-001');
  }

  const method = String(options.method || 'GET').toUpperCase();
  if (method === 'PUT' || method === 'DELETE') {
    headers.set('X-HTTP-Method-Override', method);
  }

  let res = await fetch(input, {
    ...options,
    headers
  });

  // Dual-verb auto-recovery: If an upstream reverse proxy (like IIS/WebDAV) intercepts PUT/DELETE
  // with an HTML error page (403/404), transparently retry via POST with X-HTTP-Method-Override.
  if ((method === 'PUT' || method === 'DELETE') && (res.status === 403 || res.status === 404)) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      try {
        const fallbackHeaders = new Headers(headers);
        fallbackHeaders.set('X-HTTP-Method-Override', method);
        const fallbackUrl = (method === 'DELETE' && typeof input === 'string' && !input.endsWith('/delete'))
          ? `${input}/delete`
          : input;
        const retryRes = await fetch(fallbackUrl, {
          ...options,
          method: 'POST',
          headers: fallbackHeaders
        });
        return wrapResponse(retryRes);
      } catch {
        // Fall back to original wrapped response if retry fails
      }
    }
  }

  return wrapResponse(res);
};
