import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiMe, apiPatchHandles, apiRatings } from "../api/auth";
import { apiCacheRefresh, apiCacheStatus } from "../api/cache";
import { apiPatchPreferences, apiProfile } from "../api/profile";
import { ApiError } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";

function resolveMotion(motion: "system" | "on" | "off"): "on" | "off" {
  if (motion === "on") return "on";
  if (motion === "off") return "off";
  const system =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  return system ? "off" : "on";
}

function applyPreferencesToDom(prefs: { theme: string; motion: "system" | "on" | "off" }) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.motion = resolveMotion(prefs.motion);
}

function formatTime(ts?: number) {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString();
}

function RatingGraph(props: { points: Array<{ t: number; rating: number }> }) {
  const { points } = props;
  if (points.length === 0) {
    return <div className="text-sm text-[var(--muted)]">No rated contests</div>;
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
    <div className="rounded-xl border border-[var(--stroke)] bg-[var(--card)]/70 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={pts} />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
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
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: apiProfile,
    enabled: me.isSuccess,
    retry: false,
  });
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
  const [prefsMessage, setPrefsMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );

  const [theme, setTheme] = useState<"aurora" | "sunset" | "midnight">("aurora");
  const [motion, setMotion] = useState<"system" | "on" | "off">("system");
  const [effects, setEffects] = useState({
    particles: true,
    confetti: true,
    glowCursor: true,
    ambientGradient: true,
    sounds: false,
  });

  useEffect(() => {
    if (me.data) {
      setCfHandle(me.data.cfHandle ?? "");
      setAtcoderUser(me.data.atcoderUser ?? "");
    }
  }, [me.data]);

  useEffect(() => {
    if (!profile.data) return;
    setTheme(profile.data.preferences.theme);
    setMotion(profile.data.preferences.motion);
    setEffects(profile.data.preferences.effects);
  }, [profile.data]);

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
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => {
      setCacheMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Refresh failed",
      });
    },
  });

  const savePreferences = useMutation({
    mutationFn: apiPatchPreferences,
    onSuccess: (prefs) => {
      qc.setQueryData(["profile"], (prev: any) => (prev ? { ...prev, preferences: prefs } : prev));
      applyPreferencesToDom({ theme: prefs.theme, motion: prefs.motion });
      setPrefsMessage({ kind: "success", text: "Saved" });
    },
    onError: (err) => {
      setPrefsMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Save failed",
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 page-enter">
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
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <div>
            <span className="font-semibold text-[var(--ink)]">Updated:</span>{" "}
            {formatTime(cacheStatus.data?.updatedAt)}
          </div>
          <div>
            <span className="font-semibold text-[var(--ink)]">Codeforces:</span>{" "}
            {formatTime(cacheStatus.data?.codeforcesUpdatedAt)}
          </div>
          <div>
            <span className="font-semibold text-[var(--ink)]">AtCoder Problems:</span>{" "}
            {formatTime(cacheStatus.data?.atcoderUpdatedAt)}
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

      <Card title="Experience" className="md:col-span-2">
        {prefsMessage ? (
          <Alert variant={prefsMessage.kind === "success" ? "info" : "error"} className="mb-4">
            {prefsMessage.text}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Select
              label="Theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              options={[
                { value: "aurora", label: "Aurora" },
                { value: "sunset", label: "Sunset" },
                { value: "midnight", label: "Midnight" },
              ]}
            />
            <Select
              label="Motion"
              value={motion}
              onChange={(e) => setMotion(e.target.value as any)}
              options={[
                { value: "system", label: "System" },
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
            />
            <Button
              onClick={() => {
                setPrefsMessage(null);
                savePreferences.mutate({ theme, motion, effects });
              }}
              isLoading={savePreferences.isPending}
            >
              Save preferences
            </Button>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-[var(--ink)]">Effects</div>
            {(
              [
                ["particles", "Particles backdrop"],
                ["confetti", "Confetti"],
                ["glowCursor", "Glow cursor"],
                ["ambientGradient", "Ambient gradient"],
                ["sounds", "Sounds"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={(effects as any)[key]}
                  onChange={(e) => setEffects((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
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
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Codeforces
            </div>
            {ratings.data?.codeforces ? (
              <div className="space-y-3">
                <div className="text-sm text-[var(--muted)]">
                  <a
                    className="font-semibold text-[var(--primary)] hover:underline"
                    href={`https://codeforces.com/profile/${encodeURIComponent(
                      ratings.data.codeforces.handle,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ratings.data.codeforces.handle}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-[var(--muted)]">
                  <div>
                    <div className="text-xs text-[var(--muted)]">Current</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.codeforces.current ?? "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Max</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.codeforces.max ?? "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Contests</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.codeforces.contests}
                    </div>
                  </div>
                </div>
                <RatingGraph points={ratings.data.codeforces.points} />
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)]">--</div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              AtCoder
            </div>
            {ratings.data?.atcoder ? (
              <div className="space-y-3">
                <div className="text-sm text-[var(--muted)]">
                  <a
                    className="font-semibold text-[var(--primary)] hover:underline"
                    href={`https://atcoder.jp/users/${encodeURIComponent(ratings.data.atcoder.user)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ratings.data.atcoder.user}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-[var(--muted)]">
                  <div>
                    <div className="text-xs text-[var(--muted)]">Current</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.atcoder.current ?? "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Max</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.atcoder.max ?? "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Contests</div>
                    <div className="font-semibold text-[var(--ink)]">
                      {ratings.data.atcoder.contests}
                    </div>
                  </div>
                </div>
                <RatingGraph points={ratings.data.atcoder.points} />
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)]">--</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
