const API_BASE = '/api';

export interface User {
  id: number;
  username: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends ProjectMeta {
  data: Record<string, any>;
}

const getHeaders = (hasBody = false): Record<string, string> => {
  const token = localStorage.getItem('nodecraft_token');
  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

function getTimeoutSignal(): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
      return (AbortSignal as any).timeout(10000);
    }
  } catch {}
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    // Don't leak timer if signal aborts early — clear on abort
    controller.signal.addEventListener('abort', () => clearTimeout(id), { once: true });
    return controller.signal;
  } catch {}
  return undefined;
}

async function parseJsonResponse(res: Response, endpoint?: string) {
  const isAuthAttempt = endpoint ? endpoint.includes('/auth/login') || endpoint.includes('/auth/register') : false;
  if ((res.status === 401 || res.status === 403) && !isAuthAttempt) {
    localStorage.removeItem('nodecraft_token');
    localStorage.removeItem('nodecraft_user');
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  if (res.status === 204) return {} as any;

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  let text = '';
  try {
    text = await res.text();
    if (!text) {
      data = {};
    } else if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      data = JSON.parse(text);
    } else {
      // Non-JSON 200 (e.g., proxied index.html) — treat as error
      if (!res.ok) throw new Error(`Server error (${res.status} ${res.statusText})`);
      throw new Error('Invalid JSON response from server');
    }
  } catch (e: any) {
    if (e.message?.includes('Invalid JSON')) throw e;
    if (!res.ok) {
      throw new Error(`Server error (${res.status} ${res.statusText})`);
    }
    throw new Error('Invalid JSON response from server');
  }

  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status})`);
  }
  return data;
}

export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(false),
      signal: getTimeoutSignal(),
    });
    return parseJsonResponse(res, endpoint);
  },

  async post<T = any>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(body),
      signal: getTimeoutSignal(),
    });
    return parseJsonResponse(res, endpoint);
  },

  async put<T = any>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(body),
      signal: getTimeoutSignal(),
    });
    return parseJsonResponse(res, endpoint);
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(false),
      signal: getTimeoutSignal(),
    });
    return parseJsonResponse(res, endpoint);
  },
};
