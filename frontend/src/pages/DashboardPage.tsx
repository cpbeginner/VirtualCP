import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Platform, ProblemSpec } from "../api/contests";
import { apiCreateContest, apiListContests } from "../api/contests";
import { ApiError } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";

function statusBadge(status: "created" | "running" | "finished") {
  if (status === "finished") return <Badge variant="success">FINISHED</Badge>;
  if (status === "running") return <Badge variant="warning">RUNNING</Badge>;
  return <Badge variant="neutral">CREATED</Badge>;
}

type ProblemSpecDraft = {
  id: string;
  platform: Platform;
  min: string;
  max: string;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const contestsQuery = useQuery({
    queryKey: ["contests"],
    queryFn: apiListContests,
    retry: false,
  });

  const contests = useMemo(() => {
    const list = contestsQuery.data ?? [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [contestsQuery.data]);

  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [problemSpecs, setProblemSpecs] = useState<ProblemSpecDraft[]>(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: newClientId(),
      platform: i < 3 ? ("codeforces" as const) : ("atcoder" as const),
      min: "",
      max: "",
    })),
  );
  const [cfTags, setCfTags] = useState("");
  const [excludeSolved, setExcludeSolved] = useState(false);
  const [startImmediately, setStartImmediately] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createContest = useMutation({
    mutationFn: apiCreateContest,
    onSuccess: async (contest) => {
      await qc.invalidateQueries({ queryKey: ["contests"] });
      navigate(`/contests/${contest.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to generate contest");
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card title="Create virtual contest">
        {error ? (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);

            const duration = Number(durationMinutes);
            if (!Number.isFinite(duration) || duration <= 0) {
              setError("Duration minutes must be a positive number");
              return;
            }
            if (problemSpecs.length === 0) {
              setError("Add at least one problem");
              return;
            }

            const converted: ProblemSpec[] = [];
            for (let i = 0; i < problemSpecs.length; i++) {
              const p = problemSpecs[i];
              const min = p.min.trim() ? Number(p.min) : undefined;
              const max = p.max.trim() ? Number(p.max) : undefined;
              if (min !== undefined && !Number.isFinite(min)) {
                setError(`Problem ${i + 1}: invalid min`);
                return;
              }
              if (max !== undefined && !Number.isFinite(max)) {
                setError(`Problem ${i + 1}: invalid max`);
                return;
              }
              if (min !== undefined && max !== undefined && min > max) {
                setError(`Problem ${i + 1}: min must be <= max`);
                return;
              }
              converted.push({ platform: p.platform, min, max });
            }

            createContest.mutate({
              name: name.trim() || "Virtual contest",
              durationMinutes: Math.floor(duration),
              problemSpecs: converted,
              cfTags: cfTags.trim()
                ? cfTags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                : undefined,
              excludeAlreadySolved: excludeSolved,
              startImmediately,
            });
          }}
        >
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Duration minutes"
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Problems</div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setProblemSpecs((prev) => [
                    ...prev,
                    { id: newClientId(), platform: "codeforces", min: "", max: "" },
                  ])
                }
              >
                Add problem
              </Button>
            </div>

            <div className="space-y-3">
              {problemSpecs.map((p, idx) => {
                const minLabel = p.platform === "codeforces" ? "CF rating min" : "AT difficulty min";
                const maxLabel = p.platform === "codeforces" ? "CF rating max" : "AT difficulty max";
                return (
                  <div key={p.id} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Select
                        label={`Problem ${idx + 1} platform`}
                        value={p.platform}
                        onChange={(e) => {
                          const platform = e.target.value as Platform;
                          setProblemSpecs((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, platform } : x)),
                          );
                        }}
                        options={[
                          { value: "codeforces", label: "Codeforces" },
                          { value: "atcoder", label: "AtCoder" },
                        ]}
                      />
                      <Input
                        label={minLabel}
                        type="number"
                        value={p.min}
                        onChange={(e) =>
                          setProblemSpecs((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, min: e.target.value } : x)),
                          )
                        }
                      />
                      <Input
                        label={maxLabel}
                        type="number"
                        value={p.max}
                        onChange={(e) =>
                          setProblemSpecs((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, max: e.target.value } : x)),
                          )
                        }
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => setProblemSpecs((prev) => prev.filter((x) => x.id !== p.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {problemSpecs.length === 0 ? (
                <div className="text-sm text-gray-600">No problems yet</div>
              ) : null}
            </div>
          </div>

          <Input
            label="CF tags (comma separated)"
            value={cfTags}
            onChange={(e) => setCfTags(e.target.value)}
            helperText="OR filter (any matching tag)"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={excludeSolved}
              onChange={(e) => setExcludeSolved(e.target.checked)}
            />
            Exclude already solved
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
            />
            Start immediately
          </label>

          <Button type="submit" isLoading={createContest.isPending}>
            Generate contest
          </Button>
        </form>
      </Card>

      <Card title="Your contests">
        <Table headers={["Status", "Name", "Solved", "Created"]}>
          {contests.map((c) => {
            const solvedCount = Object.keys(c.progress.solved ?? {}).length;
            const total = c.problems.length;
            return (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/contests/${c.id}`)}
              >
                <td className="px-3 py-2">{statusBadge(c.status)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                <td className="px-3 py-2 text-gray-700">
                  {solvedCount}/{total}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {new Date(c.createdAt * 1000).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
          {contests.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-gray-500" colSpan={4}>
                No contests yet
              </td>
            </tr>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}
