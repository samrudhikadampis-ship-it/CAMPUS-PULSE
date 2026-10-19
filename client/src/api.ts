export interface ApiOptions extends RequestInit {
  body?: any;
}

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "cp_auth_token";
const BACKEND_HELP = "Check that the server is deployed and VITE_API_URL points to its HTTPS origin.";

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
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, 15_000);
  const forwardAbort = () => controller.abort(opts.signal?.reason);
  opts.signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch(targetUrl, { ...config, signal: controller.signal });
    } catch (error) {
      if (didTimeout) {
        throw new Error(`The request to ${path} timed out after 15 seconds. ${BACKEND_HELP}`);
      }
      if (opts.signal?.aborted) throw error;
      throw new Error(`Cannot reach the backend for ${path}. ${BACKEND_HELP}`);
    }

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.split(";")[0].trim().toLowerCase() === "application/json";
    let data: unknown = null;
    if (isJson) {
      try {
        data = await res.json();
      } catch {
        if (didTimeout) throw new Error(`The request to ${path} timed out after 15 seconds. ${BACKEND_HELP}`);
        throw new Error(`The backend returned invalid JSON for ${path}. ${BACKEND_HELP}`);
      }
    }

    if (!res.ok) {
      if (res.status === 401 && path !== "/auth/login") setAuthToken(null);
      const message = typeof data === "object" && data !== null && "error" in data &&
        typeof data.error === "string"
        ? data.error
        : `The backend returned HTTP ${res.status} for ${path}.${isJson ? "" : ` ${BACKEND_HELP}`}`;
      throw new Error(message);
    }
    if (!isJson) throw new Error(`The backend returned an unexpected response for ${path}. ${BACKEND_HELP}`);
    return data as T;
  } finally {
    clearTimeout(timeoutId);
    opts.signal?.removeEventListener("abort", forwardAbort);
  }
}
