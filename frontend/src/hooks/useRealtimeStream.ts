import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiMe } from "../api/auth";
import { useToast } from "../components/ui/ToastProvider";

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:3001/api";

function streamUrlFromApiBase(apiBase: string): string {
  const trimmed = apiBase.replace(/\/$/, "");
  if (trimmed.endsWith("/api")) return `${trimmed}/stream`;
  return `${trimmed}/api/stream`;
}

export function useRealtimeStream() {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, retry: false });

  const stateRef = useRef<{ closed: boolean; retryMs: number }>({ closed: false, retryMs: 3000 });

  useEffect(() => {
    if (!me.isSuccess) return;

    const state = stateRef.current;
    state.closed = false;
    state.retryMs = 3000;

    let es: EventSource | null = null;
    let retryTimer: number | null = null;

    function cleanup() {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (es) {
        es.close();
        es = null;
      }
    }

    function scheduleReconnect() {
      if (state.closed) return;
      if (retryTimer) return;
      const delay = state.retryMs;
      state.retryMs = Math.min(30_000, state.retryMs * 2);
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      cleanup();
      if (state.closed) return;

      es = new EventSource(streamUrlFromApiBase(API_BASE), { withCredentials: true });
      es.onopen = () => {
        state.retryMs = 3000;
      };

      es.addEventListener("room_message", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as { roomId?: string };
          if (data.roomId) {
            void qc.invalidateQueries({ queryKey: ["roomMessages", data.roomId] });
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("room_update", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as { roomId?: string };
          if (data.roomId) {
            void qc.invalidateQueries({ queryKey: ["room", data.roomId] });
          }
          void qc.invalidateQueries({ queryKey: ["rooms"] });
        } catch {
          // ignore
        }
      });

      es.addEventListener("achievement", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as {
            achievementId?: string;
            xpDelta?: number;
            newXp?: number;
          };
          void qc.invalidateQueries({ queryKey: ["profile"] });
          pushToast({
            variant: "success",
            title: "Achievement unlocked",
            message:
              data.achievementId
                ? `${data.achievementId}${typeof data.newXp === "number" ? ` (XP ${data.newXp})` : ""}`
                : "Unlocked",
          });
        } catch {
          // ignore
        }
      });

      es.addEventListener("contest_update", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as { contestId?: string };
          if (data.contestId) {
            void qc.invalidateQueries({ queryKey: ["contest", data.contestId] });
          }
          void qc.invalidateQueries({ queryKey: ["contests"] });
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        cleanup();
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      state.closed = true;
      cleanup();
    };
  }, [me.isSuccess, qc, pushToast]);
}

