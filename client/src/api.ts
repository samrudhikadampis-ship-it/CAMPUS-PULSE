export interface ApiOptions extends RequestInit {
  body?: any;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const isPostOrPut = opts.method && ["POST", "PUT", "PATCH"].includes(opts.method.toUpperCase());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {})
  };

  const config: RequestInit = {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  };

  const res = await fetch("/api" + path, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
