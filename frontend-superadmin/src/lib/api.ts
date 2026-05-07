export const DEFAULT_API_BASE = "";

export function getApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE;
  return String(fromEnv).replace(/\/+$/, "");
}

export type ApiRequestOptions = RequestInit & {
  token?: string;
};

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const base = getApiBase();
  const token = options.token;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let response: Response;
  try {
    response = await fetch(`${base}${normalizedPath}`, {
      ...options,
      headers
    });
  } catch (_error) {
    throw new Error("Unable to reach the server. Check the backend URL or deployment status.");
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_error) {
    body = {};
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}
