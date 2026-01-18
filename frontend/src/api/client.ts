const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = undefined;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const message = data?.error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (data && typeof data === "object" && "ok" in data && data.ok === false) {
    throw new ApiError(data.error ?? "Request failed", res.status);
  }

  return data as T;
}

