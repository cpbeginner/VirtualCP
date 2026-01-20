import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiMe } from "../api/auth";
import { ApiError } from "../api/client";
import {
  apiFinishRoom,
  apiGetRoom,
  apiGetRoomMessages,
  apiLeaveRoom,
  apiPostRoomMessage,
  apiRefreshRoom,
  apiStartRoom,
  roomHasPlatform,
} from "../api/rooms";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Table } from "../components/ui/Table";
import { formatDurationHms, formatDurationMmSs, timeAgoFromUnixSeconds } from "../utils/time";

function statusBadge(status: "lobby" | "running" | "finished") {
  if (status === "finished") return <Badge variant="success">FINISHED</Badge>;
  if (status === "running") return <Badge variant="warning">RUNNING</Badge>;
  return <Badge variant="neutral">LOBBY</Badge>;
}

function motionDisabled(): boolean {
  const system =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  const userOff =
    typeof document !== "undefined" && document.documentElement.dataset.motion === "off";
  return system || userOff;
}

export function RoomPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, retry: false });

  const roomQuery = useQuery({
    queryKey: ["room", id],
    queryFn: async () => await apiGetRoom(id!),
    enabled: !!id,
    retry: false,
  });

  const messagesQuery = useQuery({
    queryKey: ["roomMessages", id],
    queryFn: async () => await apiGetRoomMessages(id!, 50),
    enabled: !!id,
    retry: false,
  });

  const room = roomQuery.data?.room;
  const scoreboard = roomQuery.data?.scoreboard ?? [];
  const userId = me.data?.id;
  const isHost = !!room && !!userId && room.ownerUserId === userId;

  const myProgress = useMemo(() => {
    if (!room || !userId) return undefined;
    return room.progressByUserId?.[userId];
  }, [room, userId]);

  const solvedCount = Object.keys(myProgress?.solved ?? {}).length;
  const total = room?.problems.length ?? 0;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!room || room.status !== "running") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [room?.status, room?.startedAt]);

  const elapsedSeconds =
    room?.status === "running" && room.startedAt ? Math.floor(nowMs / 1000 - room.startedAt) : 0;

  const lastSynced = useMemo(() => {
    const cf = myProgress?.lastSync?.codeforces ?? 0;
    const at = myProgress?.lastSync?.atcoder ?? 0;
    const max = Math.max(cf, at);
    return max > 0 ? max : undefined;
  }, [myProgress]);

  const [error, setError] = useState<string | null>(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    };
  }, []);

  const start = useMutation({
    mutationFn: async () => await apiStartRoom(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["room", id] });
      await qc.invalidateQueries({ queryKey: ["rooms"] });

      if (motionDisabled()) return;
      setCountdown(3);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 0) return null;
          return prev - 1;
        });
      }, 1000);
      window.setTimeout(() => {
        if (countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
      }, 3500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to start room"),
  });

  const refresh = useMutation({
    mutationFn: async () => await apiRefreshRoom(id!),
    onSuccess: async ({ room: r, scoreboard: s }) => {
      qc.setQueryData(["room", id], { room: r, scoreboard: s });
      await qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to refresh room"),
  });

  const finish = useMutation({
    mutationFn: async () => await apiFinishRoom(id!),
    onSuccess: async ({ room: r, scoreboard: s }) => {
      qc.setQueryData(["room", id], { room: r, scoreboard: s });
      await qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to finish room"),
  });

  const leave = useMutation({
    mutationFn: async () => await apiLeaveRoom(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.removeQueries({ queryKey: ["room", id] });
      navigate("/rooms", { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to leave room"),
  });

  const [chatText, setChatText] = useState("");
  const sendMessage = useMutation({
    mutationFn: async () => await apiPostRoomMessage(id!, chatText),
    onSuccess: async () => {
      setChatText("");
      await qc.invalidateQueries({ queryKey: ["roomMessages", id] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to send message"),
  });

  const flashSetRef = useRef<Set<string>>(new Set());
  const [flashUserIds, setFlashUserIds] = useState<Set<string>>(new Set());
  const prevSolvedCountRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (motionDisabled()) return;
    if (!scoreboard || scoreboard.length === 0) return;

    const newFlash = new Set(flashSetRef.current);
    for (const e of scoreboard) {
      const prev = prevSolvedCountRef.current[e.userId];
      if (typeof prev === "number" && e.solvedCount > prev) newFlash.add(e.userId);
      prevSolvedCountRef.current[e.userId] = e.solvedCount;
    }

    if (newFlash.size !== flashSetRef.current.size) {
      flashSetRef.current = newFlash;
      setFlashUserIds(new Set(newFlash));
      window.setTimeout(() => {
        flashSetRef.current = new Set();
        setFlashUserIds(new Set());
      }, 900);
    }
  }, [scoreboard]);

  const seenMessagesRef = useRef<Set<string>>(new Set());
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (motionDisabled()) return;
    const messages = messagesQuery.data ?? [];
    const newly: string[] = [];
    for (const m of messages) {
      if (!seenMessagesRef.current.has(m.id)) {
        seenMessagesRef.current.add(m.id);
        newly.push(m.id);
      }
    }
    if (newly.length === 0) return;
    setNewMessageIds((prev) => new Set([...prev, ...newly]));
    window.setTimeout(() => {
      setNewMessageIds((prev) => {
        const next = new Set(prev);
        for (const id of newly) next.delete(id);
        return next;
      });
    }, 450);
  }, [messagesQuery.data]);

  if (roomQuery.isLoading) return <div className="text-sm text-gray-600">Loading...</div>;
  if (roomQuery.isError || !room) return <div className="text-sm text-gray-700">Room not found</div>;

  const needsCf = roomHasPlatform(room, "codeforces");
  const needsAt = roomHasPlatform(room, "atcoder");

  return (
    <div className="space-y-6 page-enter">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {countdown !== null ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="rounded-3xl border border-white/15 bg-black/55 px-10 py-8 text-center text-white shadow-2xl backdrop-blur">
            <div key={countdown} className="vc-countdown-pop text-6xl font-semibold font-display">
              {countdown === 0 ? "GO" : countdown}
            </div>
            <div className="mt-3 text-sm text-white/75">Starting room</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/85 p-5 shadow-[0_20px_50px_var(--shadow)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.35em] text-[var(--muted)]">
              <Link className="hover:underline" to="/rooms">
                VirtualCP / Rooms
              </Link>{" "}
              / <span className="text-[var(--ink)]">{room.name}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              {room.name}
            </div>
            {isHost ? (
              <div className="mt-2 text-sm text-[var(--muted)]">
                Invite code: <span className="font-semibold text-[var(--ink)]">{room.inviteCode}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {statusBadge(room.status)}
            {room.status === "running" ? (
              <div className="text-2xl font-semibold text-[var(--ink)]">
                {formatDurationHms(elapsedSeconds)}
              </div>
            ) : null}
            <div className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">Solved:</span> {solvedCount}/{total}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {room.status === "lobby" && isHost ? (
          <Button onClick={() => start.mutate()} isLoading={start.isPending}>
            Start room
          </Button>
        ) : null}
        {room.status === "running" || room.status === "finished" ? (
          <Button variant="secondary" onClick={() => refresh.mutate()} isLoading={refresh.isPending}>
            Refresh now
          </Button>
        ) : null}
        {room.status === "running" && isHost ? (
          <Button variant="danger" onClick={() => finish.mutate()} isLoading={finish.isPending}>
            Finish room
          </Button>
        ) : null}
        {room.status === "lobby" && !isHost ? (
          <Button variant="danger" onClick={() => leave.mutate()} isLoading={leave.isPending}>
            Leave room
          </Button>
        ) : null}
      </div>

      {needsCf && !me.data?.cfHandle ? (
        <Alert variant="warning">Set Codeforces handle in Settings for auto-tracking</Alert>
      ) : null}
      {needsAt && !me.data?.atcoderUser ? (
        <Alert variant="warning">Set AtCoder user id in Settings for auto-tracking</Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card title="Scoreboard">
            <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Live standings
            </div>
            <Table headers={["Rank", "User", "Solved", "Penalty"]} className="shadow-none">
              {scoreboard.map((e) => (
                <tr
                  key={e.userId}
                  className={[
                    "transition hover:bg-[rgba(31,111,139,0.06)]",
                    flashUserIds.has(e.userId) ? "vc-score-flash" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="px-3 py-3 font-medium text-[var(--ink)]">{e.rank}</td>
                  <td className="px-3 py-3 text-[var(--ink)]">{e.username}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{e.solvedCount}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{e.penaltySeconds}</td>
                </tr>
              ))}
              {scoreboard.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={4}>
                    No members
                  </td>
                </tr>
              ) : null}
            </Table>
          </Card>

          <Card title="Problems">
            <div className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Problem set
            </div>
            <Table headers={["#", "Platform", "Difficulty", "Name", "Status", "Solve time"]} className="shadow-none">
              {room.problems.map((p, idx) => {
                const solved = myProgress?.solved?.[p.key];
                const letter = String.fromCharCode(65 + idx);
                return (
                  <tr key={p.key} className="transition hover:bg-[rgba(31,111,139,0.06)]">
                    <td className="px-3 py-3 font-medium text-[var(--ink)]">{letter}</td>
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
                    </td>
                    <td className="px-3 py-3">
                      {solved ? (
                        <Badge variant="success">SOLVED</Badge>
                      ) : (
                        <Badge variant="neutral">OPEN</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {solved ? formatDurationMmSs(solved.solveTimeSeconds) : "--"}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>

        <Card title="Chat">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Room chat
            </div>
            <div className="text-xs text-[var(--muted)]">
              Last synced: {timeAgoFromUnixSeconds(lastSynced)}
            </div>
          </div>

          <div className="flex h-[420px] flex-col gap-3">
            <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.55)] p-3">
              <div className="space-y-2">
                {(messagesQuery.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "rounded-xl border border-[var(--stroke)] bg-[var(--card)]/90 px-3 py-2 text-sm",
                      newMessageIds.has(m.id) ? "vc-chat-in" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-semibold text-[var(--ink)]">{m.username}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {new Date(m.t * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{m.text}</div>
                  </div>
                ))}
                {(messagesQuery.data ?? []).length === 0 ? (
                  <div className="text-sm text-[var(--muted)]">No messages yet</div>
                ) : null}
              </div>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!chatText.trim()) return;
                sendMessage.mutate();
              }}
            >
              <div className="flex-1">
                <Input
                  label="Message"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  helperText="Press Enter to send"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" isLoading={sendMessage.isPending}>
                  Send
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
