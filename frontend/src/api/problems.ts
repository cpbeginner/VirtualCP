import { apiRequest } from "./client";
import type { NormalizedProblem, Platform } from "./contests";

export type FavoriteProblem = {
  platform: Platform;
  key: string;
  name: string;
  url: string;
  difficulty?: number;
  tags?: string[];
  savedAt: number;
};

export async function apiSearchProblems(params: {
  platform?: "all" | Platform;
  q?: string;
  tags?: string;
  min?: number;
  max?: number;
  limit?: number;
  cursor?: string;
}): Promise<{ results: NormalizedProblem[]; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params.platform) qs.set("platform", params.platform);
  if (params.q) qs.set("q", params.q);
  if (params.tags) qs.set("tags", params.tags);
  if (typeof params.min === "number") qs.set("min", String(params.min));
  if (typeof params.max === "number") qs.set("max", String(params.max));
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);

  const res = await apiRequest<{ ok: true; results: NormalizedProblem[]; nextCursor?: string }>(
    `/problems/search?${qs.toString()}`,
  );
  return { results: res.results, nextCursor: res.nextCursor };
}

export async function apiListFavorites(): Promise<FavoriteProblem[]> {
  const res = await apiRequest<{ ok: true; favorites: FavoriteProblem[] }>("/me/favorites");
  return res.favorites;
}

export async function apiAddFavorite(platform: Platform, key: string): Promise<FavoriteProblem[]> {
  const res = await apiRequest<{ ok: true; favorites: FavoriteProblem[] }>("/me/favorites", {
    method: "POST",
    body: { platform, key },
  });
  return res.favorites;
}

export async function apiRemoveFavorite(platform: Platform, key: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/me/favorites/${encodeURIComponent(platform)}/${encodeURIComponent(key)}`, {
    method: "DELETE",
    body: {},
  });
}

