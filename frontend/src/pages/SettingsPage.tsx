import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiMe, apiPatchHandles, apiRatings } from "../api/auth";
import { apiCacheRefresh, apiCacheStatus } from "../api/cache";
import { ApiError } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

function formatTime(ts?: number) {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString();
}

function RatingGraph(props: { points: Array<{ t: number; rating: number }> }) {
  const { points } = props;
  if (points.length === 0) {
    return <div className="text-sm text-gray-600">No rated contests</div>;
  }

  const w = 600;
  const h = 200;
  const pad = 24;

  const minX = Math.min(...points.map((p) => p.t));
  const maxX = Math.max(...points.map((p) => p.t));
  const minY = Math.min(...points.map((p) => p.rating));
  const maxY = Math.max(...points.map((p) => p.rating));

  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY - minY);

  const toX = (t: number) => pad + ((t - minX) / xRange) * (w - pad * 2);
  const toY = (rating: number) => h - pad - ((rating - minY) / yRange) * (h - pad * 2);

  const pts = points
    .map((p) => `${toX(p.t).toFixed(1)},${toY(p.rating).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={pts} />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <div>Min: {minY}</div>
        <div>Max: {maxY}</div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, retry: false });
  const cacheStatus = useQuery({ queryKey: ["cacheStatus"], queryFn: apiCacheStatus, retry: false });
  const ratings = useQuery({
    queryKey: ["ratings", me.data?.cfHandle, me.data?.atcoderUser],
    queryFn: apiRatings,
    enabled: !!me.data?.cfHandle || !!me.data?.atcoderUser,
    retry: false,
  });

  const [cfHandle, setCfHandle] = useState("");
  const [atcoderUser, setAtcoderUser] = useState("");
  const [profileMessage, setProfileMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [cacheMessage, setCacheMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (me.data) {
      setCfHandle(me.data.cfHandle ?? "");
      setAtcoderUser(me.data.atcoderUser ?? "");
    }
  }, [me.data]);

  const saveHandles = useMutation({
    mutationFn: apiPatchHandles,
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      setProfileMessage({ kind: "success", text: "Saved" });
    },
    onError: (err) => {
      setProfileMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Save failed",
      });
    },
  });

  const refreshCache = useMutation({
    mutationFn: apiCacheRefresh,
    onSuccess: (meta) => {
      qc.setQueryData(["cacheStatus"], meta);
      setCacheMessage({ kind: "success", text: "Cache refreshed" });
    },
    onError: (err) => {
      setCacheMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Refresh failed",
      });
    },
  });

  const atcoderWarning = useMemo(() => {
    const meta = cacheStatus.data;
    if (!meta) return null;
    if (!meta.atcoderUpdatedAt) return "AtCoder Problems is unavailable or not yet cached.";
    return null;
  }, [cacheStatus.data]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card title="Profile / Handles">
        {profileMessage ? (
          <Alert variant={profileMessage.kind === "success" ? "info" : "error"} className="mb-4">
            {profileMessage.text}
          </Alert>
        ) : null}
        <div className="space-y-4">
          <Input
            label="Codeforces handle"
            value={cfHandle}
            onChange={(e) => setCfHandle(e.target.value)}
          />
          <Input
            label="AtCoder user id"
            value={atcoderUser}
            onChange={(e) => setAtcoderUser(e.target.value)}
          />
          <Button
            onClick={() => {
              setProfileMessage(null);
              saveHandles.mutate({ cfHandle: cfHandle.trim(), atcoderUser: atcoderUser.trim() });
            }}
            isLoading={saveHandles.isPending}
          >
            Save
          </Button>
        </div>
      </Card>

      <Card title="Problem cache">
        {cacheMessage ? (
          <Alert variant={cacheMessage.kind === "success" ? "info" : "error"} className="mb-4">
            {cacheMessage.text}
          </Alert>
        ) : null}
        {atcoderWarning ? (
          <Alert variant="warning" className="mb-4">
            {atcoderWarning}
          </Alert>
        ) : null}
        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Updated:</span> {formatTime(cacheStatus.data?.updatedAt)}
          </div>
          <div>
            <span className="font-medium">Codeforces:</span> {formatTime(cacheStatus.data?.codeforcesUpdatedAt)}
          </div>
          <div>
            <span className="font-medium">AtCoder Problems:</span> {formatTime(cacheStatus.data?.atcoderUpdatedAt)}
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setCacheMessage(null);
              refreshCache.mutate();
            }}
            isLoading={refreshCache.isPending}
          >
            Refresh cache
          </Button>
        </div>
      </Card>

      <Card title="Ratings" className="md:col-span-2">
        {me.data && !me.data.cfHandle && !me.data.atcoderUser ? (
          <Alert variant="warning" className="mb-4">
            Set handles above to load rating graphs
          </Alert>
        ) : null}
        {ratings.data?.warnings?.length ? (
          <Alert variant="warning" className="mb-4">
            {ratings.data.warnings.join(" | ")}
          </Alert>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium text-gray-900">Codeforces</div>
            {ratings.data?.codeforces ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  <a
                    className="text-blue-600 hover:underline"
                    href={`https://codeforces.com/profile/${encodeURIComponent(
                      ratings.data.codeforces.handle,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ratings.data.codeforces.handle}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-gray-700">
                  <div>
                    <div className="text-xs text-gray-500">Current</div>
                    <div className="font-medium">{ratings.data.codeforces.current ?? "--"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Max</div>
                    <div className="font-medium">{ratings.data.codeforces.max ?? "--"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Contests</div>
                    <div className="font-medium">{ratings.data.codeforces.contests}</div>
                  </div>
                </div>
                <RatingGraph points={ratings.data.codeforces.points} />
              </div>
            ) : (
              <div className="text-sm text-gray-600">--</div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-900">AtCoder</div>
            {ratings.data?.atcoder ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  <a
                    className="text-blue-600 hover:underline"
                    href={`https://atcoder.jp/users/${encodeURIComponent(ratings.data.atcoder.user)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ratings.data.atcoder.user}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-gray-700">
                  <div>
                    <div className="text-xs text-gray-500">Current</div>
                    <div className="font-medium">{ratings.data.atcoder.current ?? "--"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Max</div>
                    <div className="font-medium">{ratings.data.atcoder.max ?? "--"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Contests</div>
                    <div className="font-medium">{ratings.data.atcoder.contests}</div>
                  </div>
                </div>
                <RatingGraph points={ratings.data.atcoder.points} />
              </div>
            ) : (
              <div className="text-sm text-gray-600">--</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
