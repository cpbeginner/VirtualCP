import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { apiMe } from "../api/auth";
import {
  apiDeleteContest,
  apiFinishContest,
  apiGetContest,
  apiRefreshContest,
  apiStartContest,
} from "../api/contests";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { formatDurationHms, formatDurationMmSs, timeAgoFromUnixSeconds } from "../utils/time";

function statusBadge(status: "created" | "running" | "finished") {
  if (status === "finished") return <Badge variant="success">FINISHED</Badge>;
  if (status === "running") return <Badge variant="warning">RUNNING</Badge>;
  return <Badge variant="neutral">CREATED</Badge>;
}

export function ContestPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, retry: false });
  const contestQuery = useQuery({
    queryKey: ["contest", id],
    queryFn: async () => await apiGetContest(id!),
    enabled: !!id,
    retry: false,
    refetchInterval: 5000,
  });

  const contest = contestQuery.data;
  const solvedCount = Object.keys(contest?.progress?.solved ?? {}).length;
  const total = contest?.problems.length ?? 0;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!contest || contest.status !== "running") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [contest?.status, contest?.startedAt]);

  const elapsedSeconds =
    contest?.status === "running" && contest.startedAt ? Math.floor(nowMs / 1000 - contest.startedAt) : 0;

  const lastSynced = useMemo(() => {
    if (!contest) return undefined;
    const cf = contest.progress.lastSync?.codeforces ?? 0;
    const at = contest.progress.lastSync?.atcoder ?? 0;
    const max = Math.max(cf, at);
    return max > 0 ? max : undefined;
  }, [contest]);

  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => await apiStartContest(id!),
    onSuccess: (c) => {
      qc.setQueryData(["contest", id], c);
      qc.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to start contest"),
  });

  const refresh = useMutation({
    mutationFn: async () => await apiRefreshContest(id!),
    onSuccess: ({ contest: c }) => {
      qc.setQueryData(["contest", id], c);
      qc.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to refresh contest"),
  });

  const finish = useMutation({
    mutationFn: async () => await apiFinishContest(id!),
    onSuccess: (c) => {
      qc.setQueryData(["contest", id], c);
      qc.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to finish contest"),
  });

  const del = useMutation({
    mutationFn: async () => await apiDeleteContest(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["contests"] });
      qc.removeQueries({ queryKey: ["contest", id] });
      navigate("/dashboard", { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to delete contest"),
  });

  if (contestQuery.isLoading) {
    return <div className="text-sm text-gray-600">Loading...</div>;
  }

  if (contestQuery.isError || !contest) {
    return <div className="text-sm text-gray-700">Contest not found</div>;
  }

  const needsCf = contest.problems.some((p) => p.platform === "codeforces");
  const needsAt = contest.problems.some((p) => p.platform === "atcoder");
  const missingHandles =
    (needsCf && !me.data?.cfHandle) || (needsAt && !me.data?.atcoderUser);

  const nowUnix = Math.floor(nowMs / 1000);
  const cfLast = contest.progress.lastSync?.codeforces;
  const atLast = contest.progress.lastSync?.atcoder;
  const pollStaleSeconds = 90;
  const pollWarmupSeconds = 60;
  const cfStale =
    contest.status === "running" &&
    needsCf &&
    !!me.data?.cfHandle &&
    elapsedSeconds > pollWarmupSeconds &&
    (!cfLast || nowUnix - cfLast > pollStaleSeconds);
  const atStale =
    contest.status === "running" &&
    needsAt &&
    !!me.data?.atcoderUser &&
    elapsedSeconds > pollWarmupSeconds &&
    (!atLast || nowUnix - atLast > pollStaleSeconds);
  const showPollError = !missingHandles && (cfStale || atStale);

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {missingHandles ? (
        <Alert variant="warning">
          Set handles in Settings to enable auto-tracking
        </Alert>
      ) : null}
      {showPollError ? (
        <Alert variant="error">Auto-tracking temporarily unavailable</Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          <Link className="hover:underline" to="/dashboard">
            VirtualCP / Dashboard
          </Link>{" "}
          / <span className="text-gray-900">{contest.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {statusBadge(contest.status)}
          {contest.status === "running" ? (
            <div className="text-2xl font-semibold text-gray-900">{formatDurationHms(elapsedSeconds)}</div>
          ) : null}
          <div className="text-sm text-gray-700">
            <span className="font-medium">Solved:</span> {solvedCount}/{total}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {contest.status === "created" ? (
          <Button onClick={() => start.mutate()} isLoading={start.isPending}>
            Start contest
          </Button>
        ) : null}
        {contest.status === "running" || contest.status === "finished" ? (
          <Button variant="secondary" onClick={() => refresh.mutate()} isLoading={refresh.isPending}>
            Refresh now
          </Button>
        ) : null}
        {contest.status === "running" ? (
          <Button variant="danger" onClick={() => finish.mutate()} isLoading={finish.isPending}>
            Finish contest
          </Button>
        ) : null}
        <Button
          variant="danger"
          onClick={() => {
            setError(null);
            if (window.confirm("Delete this contest?")) {
              del.mutate();
            }
          }}
          isLoading={del.isPending}
        >
          Delete contest
        </Button>
      </div>

      <Table headers={["#", "Platform", "Difficulty", "Name", "Status", "Solve time"]}>
        {contest.problems.map((p, idx) => {
          const solved = contest.progress.solved?.[p.key];
          const letter = String.fromCharCode(65 + idx);
          return (
            <tr key={p.key}>
              <td className="px-3 py-2 font-medium text-gray-900">{letter}</td>
              <td className="px-3 py-2">
                <Badge variant="neutral">{p.platform === "codeforces" ? "CF" : "AT"}</Badge>
              </td>
              <td className="px-3 py-2 text-gray-700">{p.difficulty ?? "--"}</td>
              <td className="px-3 py-2">
                <a className="text-blue-600 hover:underline" href={p.url} target="_blank" rel="noreferrer">
                  {p.name}
                </a>
              </td>
              <td className="px-3 py-2">
                {solved ? <Badge variant="success">SOLVED</Badge> : <Badge variant="neutral">OPEN</Badge>}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {solved ? formatDurationMmSs(solved.solveTimeSeconds) : "--"}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className="text-sm text-gray-600">Last synced: {timeAgoFromUnixSeconds(lastSynced)}</div>
    </div>
  );
}
