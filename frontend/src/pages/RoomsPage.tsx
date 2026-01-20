import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Platform, ProblemSpec } from "../api/contests";
import { ApiError } from "../api/client";
import { apiCreateRoom, apiJoinRoom, apiListRooms } from "../api/rooms";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";

function statusBadge(status: "lobby" | "running" | "finished") {
  if (status === "finished") return <Badge variant="success">FINISHED</Badge>;
  if (status === "running") return <Badge variant="warning">RUNNING</Badge>;
  return <Badge variant="neutral">LOBBY</Badge>;
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

export function RoomsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: apiListRooms,
    retry: false,
  });

  const rooms = useMemo(() => {
    const list = roomsQuery.data ?? [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [roomsQuery.data]);

  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [problemSpecs, setProblemSpecs] = useState<ProblemSpecDraft[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: newClientId(),
      platform: i < 2 ? ("codeforces" as const) : ("atcoder" as const),
      min: "",
      max: "",
    })),
  );
  const [cfTags, setCfTags] = useState("");
  const [excludeSolved, setExcludeSolved] = useState(false);
  const [startImmediately, setStartImmediately] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const createRoom = useMutation({
    mutationFn: apiCreateRoom,
    onSuccess: async (room) => {
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/rooms/${room.id}`);
    },
    onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Failed to create room"),
  });

  const joinRoom = useMutation({
    mutationFn: async () => await apiJoinRoom(joinRoomId.trim(), joinInviteCode.trim()),
    onSuccess: async (room) => {
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/rooms/${room.id}`);
    },
    onError: (err) => setJoinError(err instanceof ApiError ? err.message : "Failed to join room"),
  });

  return (
    <div className="space-y-6 page-enter">
      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/85 p-6 shadow-[0_20px_50px_var(--shadow)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
              VirtualCP
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Rooms
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Create a shared room and race solves together.
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--stroke)] bg-[rgba(31,111,139,0.08)] px-4 py-3 text-sm text-[var(--muted)]">
            Total rooms: <span className="font-semibold text-[var(--ink)]">{rooms.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <Card title="Create room">
          <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Build a room set
          </div>
          {createError ? (
            <Alert variant="error" className="mb-4">
              {createError}
            </Alert>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setCreateError(null);

              const duration = Number(durationMinutes);
              if (!Number.isFinite(duration) || duration <= 0) {
                setCreateError("Duration minutes must be a positive number");
                return;
              }
              if (!name.trim()) {
                setCreateError("Name is required");
                return;
              }
              if (problemSpecs.length === 0) {
                setCreateError("Add at least one problem");
                return;
              }

              const converted: ProblemSpec[] = [];
              for (let i = 0; i < problemSpecs.length; i++) {
                const p = problemSpecs[i];
                const min = p.min.trim() ? Number(p.min) : undefined;
                const max = p.max.trim() ? Number(p.max) : undefined;
                if (min !== undefined && !Number.isFinite(min)) {
                  setCreateError(`Problem ${i + 1}: invalid min`);
                  return;
                }
                if (max !== undefined && !Number.isFinite(max)) {
                  setCreateError(`Problem ${i + 1}: invalid max`);
                  return;
                }
                if (min !== undefined && max !== undefined && min > max) {
                  setCreateError(`Problem ${i + 1}: min cannot exceed max`);
                  return;
                }
                converted.push({ platform: p.platform, min, max });
              }

              const tags = cfTags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

              createRoom.mutate({
                name: name.trim(),
                durationMinutes: duration,
                problemSpecs: converted,
                cfTags: tags.length > 0 ? tags : undefined,
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--ink)]">Problems</div>
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
              {problemSpecs.map((p, idx) => {
                const minLabel = p.platform === "codeforces" ? "CF rating min" : "AT difficulty min";
                const maxLabel = p.platform === "codeforces" ? "CF rating max" : "AT difficulty max";
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.7)] p-3"
                  >
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
            </div>

            <Input
              label="CF tags (comma separated)"
              value={cfTags}
              onChange={(e) => setCfTags(e.target.value)}
              helperText="OR filter (any matching tag)"
            />

            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={excludeSolved}
                onChange={(e) => setExcludeSolved(e.target.checked)}
              />
              Exclude already solved (based on the host account)
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
              />
              Start immediately
            </label>

            <Button type="submit" isLoading={createRoom.isPending}>
              Create room
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Join room">
            <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Enter invite
            </div>
            {joinError ? (
              <Alert variant="error" className="mb-4">
                {joinError}
              </Alert>
            ) : null}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setJoinError(null);
                if (!joinRoomId.trim() || !joinInviteCode.trim()) {
                  setJoinError("Room id and invite code are required");
                  return;
                }
                joinRoom.mutate();
              }}
            >
              <Input label="Room id" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value)} />
              <Input
                label="Invite code"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
              />
              <Button type="submit" isLoading={joinRoom.isPending}>
                Join room
              </Button>
            </form>
          </Card>

          <Card title="Your rooms">
            <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Recent rooms
            </div>
            <Table headers={["Status", "Name", "Members", "Created"]}>
              {rooms.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer transition hover:bg-[rgba(31,111,139,0.06)]"
                  onClick={() => navigate(`/rooms/${r.id}`)}
                >
                  <td className="px-3 py-3">{statusBadge(r.status)}</td>
                  <td className="px-3 py-3 font-medium text-[var(--ink)]">
                    {r.name}{" "}
                    {r.isHost ? <span className="text-[var(--muted)]">(host)</span> : null}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{r.membersCount}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {new Date(r.createdAt * 1000).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {rooms.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={4}>
                    No rooms yet
                  </td>
                </tr>
              ) : null}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}

