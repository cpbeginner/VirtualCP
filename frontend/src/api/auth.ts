import { apiRequest } from "./client";

export type User = {
  id: string;
  username: string;
  cfHandle?: string;
  atcoderUser?: string;
};

export type RatingSeries = {
  contests: number;
  current?: number;
  max?: number;
  points: Array<{ t: number; rating: number }>;
};

export type RatingsResponse = {
  fetchedAt: number;
  warnings: string[];
  codeforces?: { handle: string } & RatingSeries;
  atcoder?: { user: string } & RatingSeries;
};

export async function apiMe(): Promise<User> {
  const res = await apiRequest<{ ok: true; user: User }>("/me");
  return res.user;
}

export async function apiRegister(input: {
  username: string;
  password: string;
  cfHandle?: string;
  atcoderUser?: string;
}): Promise<User> {
  const res = await apiRequest<{ ok: true; user: User }>("/auth/register", {
    method: "POST",
    body: input,
  });
  return res.user;
}

export async function apiLogin(input: { username: string; password: string }): Promise<User> {
  const res = await apiRequest<{ ok: true; user: User }>("/auth/login", {
    method: "POST",
    body: input,
  });
  return res.user;
}

export async function apiLogout(): Promise<void> {
  await apiRequest<{ ok: true }>("/auth/logout", { method: "POST", body: {} });
}

export async function apiPatchHandles(input: {
  cfHandle?: string;
  atcoderUser?: string;
}): Promise<User> {
  const res = await apiRequest<{ ok: true; user: User }>("/me/handles", {
    method: "PATCH",
    body: input,
  });
  return res.user;
}

export async function apiRatings(): Promise<RatingsResponse> {
  const res = await apiRequest<{ ok: true } & RatingsResponse>("/me/ratings");
  return {
    fetchedAt: res.fetchedAt,
    warnings: res.warnings ?? [],
    codeforces: res.codeforces,
    atcoder: res.atcoder,
  };
}
