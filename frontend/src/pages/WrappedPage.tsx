import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMe } from "../api/auth";
import { apiCfWrapped } from "../api/wrapped";
import { ApiError } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StoryPlayer } from "../components/wrapped/StoryPlayer";

const years = [2025, 2024, 2023] as const;

function chipClass(active: boolean): string {
  return [
    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
    active
      ? "bg-[var(--primary)] text-[var(--primary-ink)] shadow-[0_12px_28px_rgba(31,111,139,0.3)]"
      : "border border-[var(--stroke)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]",
  ].join(" ");
}

export function WrappedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, retry: false });
  const [year, setYear] = useState<(typeof years)[number]>(2025);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrappedQuery = useQuery({
    queryKey: ["wrapped", "codeforces", year],
    queryFn: async () => await apiCfWrapped(year),
    enabled: !!me.data?.cfHandle,
    retry: false,
  });

  const refresh = useMutation({
    mutationFn: async () => await apiCfWrapped(year, true),
    onSuccess: (data) => {
      qc.setQueryData(["wrapped", "codeforces", year], data);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Refresh failed");
    },
  });

  const warningsText = useMemo(() => {
    const warnings = wrappedQuery.data?.warnings ?? [];
    return warnings.length ? warnings.join(" | ") : null;
  }, [wrappedQuery.data?.warnings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Wrapped
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Codeforces Wrapped
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            Pick a year and play your story.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {years.map((y) => (
            <button key={y} className={chipClass(y === year)} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!me.data?.cfHandle ? (
        <Card title="Codeforces handle required">
          <Alert variant="warning" className="mb-4">
            Set Codeforces handle in Settings
          </Alert>
          <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
        </Card>
      ) : (
        <Card title="Your story">
          {warningsText ? (
            <Alert variant="warning" className="mb-4">
              {warningsText}
            </Alert>
          ) : null}

          {wrappedQuery.isLoading ? (
            <div className="text-sm text-[var(--muted)]">Loading...</div>
          ) : wrappedQuery.isError ? (
            <Alert variant="error">Failed to load wrapped</Alert>
          ) : wrappedQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--card)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Unique solved
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink)] font-display">
                    {wrappedQuery.data.wrapped.problems.uniqueSolved}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--card)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    AC submissions
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink)] font-display">
                    {wrappedQuery.data.wrapped.problems.acSubmissions}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--card)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Rating delta
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink)] font-display">
                    {wrappedQuery.data.wrapped.rating.delta ?? 0}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsOpen(true)}>Play story</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    refresh.mutate();
                  }}
                  isLoading={refresh.isPending}
                >
                  Refresh
                </Button>
              </div>

              {isOpen ? (
                <StoryPlayer
                  wrapped={wrappedQuery.data.wrapped}
                  year={year}
                  onClose={() => setIsOpen(false)}
                />
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

