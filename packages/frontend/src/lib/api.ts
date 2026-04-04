const TOKEN_KEY = 'agentlens_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getApiBase = (): string => {
  const envBase = import.meta.env.VITE_API_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/$/, '');

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:47777';
  }
  return window.location.origin;
};

export const toApiUrl = (path: string): string => `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;

const withAuth = (headers: HeadersInit = {}): HeadersInit => {
  const token = getToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(toApiUrl(path), { headers: withAuth() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(toApiUrl(path), {
    method: 'POST',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
