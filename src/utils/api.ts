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

const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('nodecraft_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function parseJsonResponse(res: Response) {
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('nodecraft_token');
    localStorage.removeItem('nodecraft_user');
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  let data: any;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (!res.ok) {
      throw new Error(`Server error (${res.status} ${res.statusText})`);
    }
    data = {};
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
      headers: getHeaders(),
    });
    return parseJsonResponse(res);
  },

  async post<T = any>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return parseJsonResponse(res);
  },

  async put<T = any>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return parseJsonResponse(res);
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return parseJsonResponse(res);
  },
};
