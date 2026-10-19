export interface ApiOptions extends RequestInit {
  body?: any;
}

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "cp_auth_token";

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {})
  };

  const config: RequestInit = {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  };

  const targetUrl = API_BASE ? `${API_BASE}/api${path}` : `/api${path}`;
  const res = await fetch(targetUrl, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") setAuthToken(null);
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
