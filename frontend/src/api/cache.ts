import { apiRequest } from "./client";

export type CacheMeta = {
  updatedAt: number;
  codeforcesUpdatedAt?: number;
  atcoderUpdatedAt?: number;
};

export async function apiCacheStatus(): Promise<CacheMeta> {
  const res = await apiRequest<{ ok: true; meta: CacheMeta }>("/cache/status");
  return res.meta;
}

export async function apiCacheRefresh(): Promise<CacheMeta> {
  const res = await apiRequest<{ ok: true; meta: CacheMeta }>("/cache/refresh", {
    method: "POST",
    body: {},
  });
  return res.meta;
}

