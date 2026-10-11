export interface ApiOptions extends RequestInit {
  body?: any;
}

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
