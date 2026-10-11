export interface ApiOptions extends RequestInit {
  body?: any;
}

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const BACKEND_HELP = "Check that the server is deployed and client/vercel.json points to it.";

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
        throw new Error(`The request to ${targetUrl} timed out after 15 seconds. ${BACKEND_HELP}`);
      }
      if (opts.signal?.aborted) throw error;
      throw new Error(`Cannot reach the backend at /api. ${BACKEND_HELP} (${error instanceof Error ? error.message : String(error)})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new Error(`${targetUrl} returned ${contentType || "no content type"} instead of application/json (HTTP ${res.status}). ${BACKEND_HELP}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      if (didTimeout) {
        throw new Error(`The request to ${targetUrl} timed out after 15 seconds. ${BACKEND_HELP}`);
      }
      throw new Error(`${targetUrl} returned invalid JSON (HTTP ${res.status}). ${BACKEND_HELP}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `The backend returned HTTP ${res.status} for ${path}. ${BACKEND_HELP}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeoutId);
    opts.signal?.removeEventListener("abort", forwardAbort);
  }
}
