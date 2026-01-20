import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Platform } from "../api/contests";
import { ApiError } from "../api/client";
import { apiAddFavorite, apiListFavorites, apiRemoveFavorite, apiSearchProblems } from "../api/problems";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";

function motionDisabled(): boolean {
  const system =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  const userOff =
    typeof document !== "undefined" && document.documentElement.dataset.motion === "off";
  return system || userOff;
}

export function ProblemsPage() {
  const qc = useQueryClient();

  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [q, setQ] = useState("");
  const [tags, setTags] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pulsingKey, setPulsingKey] = useState<string | null>(null);

  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: apiListFavorites, retry: false });
  const favorites = favoritesQuery.data ?? [];
  const favoritesSet = useMemo(() => new Set(favorites.map((f) => `${f.platform}:${f.key}`)), [favorites]);

  const search = useInfiniteQuery({
    queryKey: ["problemsSearch", { platform, q, tags, min, max }],
    queryFn: async ({ pageParam }) => {
      const minNum = min.trim() ? Number(min) : undefined;
      const maxNum = max.trim() ? Number(max) : undefined;
      return await apiSearchProblems({
        platform,
        q: q.trim() || undefined,
        tags: tags.trim() || undefined,
        min: minNum,
        max: maxNum,
        limit: 50,
        cursor: pageParam as string | undefined,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });

  const results = useMemo(() => {
    return (search.data?.pages ?? []).flatMap((p) => p.results);
  }, [search.data]);

  const addFav = useMutation({
    mutationFn: async (args: { platform: Platform; key: string }) => await apiAddFavorite(args.platform, args.key),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["favorites"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to add favorite"),
  });

  const removeFav = useMutation({
    mutationFn: async (args: { platform: Platform; key: string }) => await apiRemoveFavorite(args.platform, args.key),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to remove favorite"),
  });

  const animateFav = !motionDisabled();

  return (
    <div className="space-y-6 page-enter">
      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/85 p-6 shadow-[0_20px_50px_var(--shadow)] backdrop-blur">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
            VirtualCP
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Problems
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            Search the cached problem index and save favorites.
          </div>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card title="Search">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                options={[
                  { value: "all", label: "All" },
                  { value: "codeforces", label: "Codeforces" },
                  { value: "atcoder", label: "AtCoder" },
                ]}
              />
              <Input label="Query" value={q} onChange={(e) => setQ(e.target.value)} />
              <Input
                label="CF tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                helperText="Applied only to Codeforces (OR)"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Min difficulty" type="number" value={min} onChange={(e) => setMin(e.target.value)} />
                <Input label="Max difficulty" type="number" value={max} onChange={(e) => setMax(e.target.value)} />
              </div>
            </div>
          </Card>

          <Card title="Results">
            <Table headers={["Platform", "Difficulty", "Name", "Favorite"]} className="shadow-none">
              {results.map((p) => {
                const favKey = `${p.platform}:${p.key}`;
                const isFav = favoritesSet.has(favKey);
                return (
                  <tr key={favKey} className="transition hover:bg-[rgba(31,111,139,0.06)]">
                    <td className="px-3 py-3">
                      <Badge variant="neutral">{p.platform === "codeforces" ? "CF" : "AT"}</Badge>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">{p.difficulty ?? "--"}</td>
                    <td className="px-3 py-3">
                      <a
                        className="font-semibold text-[var(--primary)] hover:underline"
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.name}
                      </a>
                      <div className="mt-1 text-xs text-[var(--muted)]">{p.key}</div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className={[
                          "rounded-xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.7)] px-3 py-2 text-sm font-semibold",
                          isFav ? "text-[var(--accent)]" : "text-[var(--muted)]",
                          animateFav ? "transition hover:scale-[1.03]" : "",
                        ].join(" ")}
                        onClick={() => {
                          setError(null);
                          if (animateFav) {
                            setPulsingKey(favKey);
                            window.setTimeout(() => setPulsingKey((prev) => (prev === favKey ? null : prev)), 650);
                          }
                          if (isFav) removeFav.mutate({ platform: p.platform, key: p.key });
                          else addFav.mutate({ platform: p.platform, key: p.key });
                        }}
                        title={isFav ? "Remove favorite" : "Add favorite"}
                      >
                        <span className={animateFav && pulsingKey === favKey ? "vc-fav-pulse" : ""}>
                          {isFav ? "★" : "☆"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={4}>
                    {search.isLoading ? "Loading..." : "No results"}
                  </td>
                </tr>
              ) : null}
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-[var(--muted)]">
                {results.length} result{results.length === 1 ? "" : "s"}
              </div>
              {search.hasNextPage ? (
                <Button
                  variant="secondary"
                  onClick={() => void search.fetchNextPage()}
                  isLoading={search.isFetchingNextPage}
                >
                  Load more
                </Button>
              ) : null}
            </div>
          </Card>
        </div>

        <Card title="Favorites">
          <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Saved problems
          </div>
          <div className="space-y-3">
            {favorites.map((f) => (
              <div
                key={`${f.platform}:${f.key}`}
                className="rounded-2xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.65)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{f.platform === "codeforces" ? "CF" : "AT"}</Badge>
                      <div className="font-semibold text-[var(--ink)]">{f.name}</div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{f.key}</div>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => removeFav.mutate({ platform: f.platform, key: f.key })}
                    isLoading={removeFav.isPending}
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)]">
                  Difficulty: <span className="font-semibold text-[var(--ink)]">{f.difficulty ?? "--"}</span>
                </div>
                <div className="mt-2">
                  <a className="text-sm font-semibold text-[var(--primary)] hover:underline" href={f.url} target="_blank" rel="noreferrer">
                    Open problem
                  </a>
                </div>
              </div>
            ))}
            {favorites.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">No favorites yet</div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
