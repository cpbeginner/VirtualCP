import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiPatchPreferences, apiProfile } from "../api/profile";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { ConfettiBurst } from "../components/effects/ConfettiBurst";
import { useToast } from "../components/ui/ToastProvider";

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  });
  return reduced;
}

export function EffectsLabPage() {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();

  const profile = useQuery({ queryKey: ["profile"], queryFn: apiProfile, retry: false });
  const prefs = profile.data?.preferences;

  const motionOff = useMemo(() => {
    if (!prefs) return true;
    if (prefersReducedMotion) return true;
    return prefs.motion === "off";
  }, [prefs, prefersReducedMotion]);

  const effects = prefs?.effects;

  const patchPrefs = useMutation({
    mutationFn: apiPatchPreferences,
    onSuccess: (nextPrefs) => {
      qc.setQueryData(["profile"], (prev: any) => (prev ? { ...prev, preferences: nextPrefs } : prev));
    },
  });

  const [confettiRun, setConfettiRun] = useState(0);
  const [ringRun, setRingRun] = useState(0);
  const [shimmerRun, setShimmerRun] = useState(0);

  return (
    <div className="space-y-6 page-enter">
      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/85 p-6 shadow-[0_20px_50px_var(--shadow)] backdrop-blur">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
            VirtualCP
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Effects Lab
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            Preview motion and visual effects (respects reduced motion and preferences)
          </div>
        </div>
      </div>

      {profile.isError ? (
        <Alert variant="error">Failed to load profile</Alert>
      ) : prefs ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card title="Status">
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <div>
                System reduced motion:{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {prefersReducedMotion ? "ON" : "OFF"}
                </span>
              </div>
              <div>
                Preference motion:{" "}
                <span className="font-semibold text-[var(--ink)]">{prefs.motion.toUpperCase()}</span>
              </div>
              <div>
                Effects active:{" "}
                <span className="font-semibold text-[var(--ink)]">{motionOff ? "NO" : "YES"}</span>
              </div>
            </div>
            {motionOff ? (
              <Alert variant="warning" className="mt-4">
                Motion is disabled (system reduced motion or preference off).
              </Alert>
            ) : null}
          </Card>

          <Card title="Quick preferences">
            <div className="grid grid-cols-1 gap-4">
              <Select
                label="Theme"
                value={prefs.theme}
                onChange={(e) =>
                  patchPrefs.mutate({ theme: e.target.value as any })
                }
                options={[
                  { value: "aurora", label: "Aurora" },
                  { value: "sunset", label: "Sunset" },
                  { value: "midnight", label: "Midnight" },
                ]}
              />
              <Select
                label="Motion"
                value={prefs.motion}
                onChange={(e) => patchPrefs.mutate({ motion: e.target.value as any })}
                options={[
                  { value: "system", label: "System" },
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
              <div className="text-sm font-semibold text-[var(--ink)]">Effects</div>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    ["particles", "Particles backdrop"],
                    ["ambientGradient", "Ambient gradient"],
                    ["glowCursor", "Glow cursor"],
                    ["confetti", "Confetti"],
                    ["sounds", "Sounds"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={!!(effects as any)?.[key]}
                      onChange={(e) =>
                        patchPrefs.mutate({ effects: { [key]: e.target.checked } as any })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {patchPrefs.isError ? (
                <Alert variant="error">Failed to save preferences</Alert>
              ) : null}
            </div>
          </Card>
        </div>
      ) : (
        <div className="p-6 text-sm text-[var(--muted)]">Loading...</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Triggers">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  variant: "success",
                  title: "Toast test",
                  message: "This is a preview notification.",
                })
              }
            >
              Trigger toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (motionOff || !effects?.confetti) return;
                setConfettiRun((n) => n + 1);
              }}
              disabled={motionOff || !effects?.confetti}
            >
              Confetti burst
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (motionOff) return;
                setRingRun((n) => n + 1);
              }}
              disabled={motionOff}
            >
              Progress ring
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (motionOff) return;
                setShimmerRun((n) => n + 1);
              }}
              disabled={motionOff}
            >
              Card shimmer
            </Button>
          </div>
          {motionOff ? (
            <div className="mt-4 text-sm text-[var(--muted)]">
              Motion is disabled, so visual animations are not played.
            </div>
          ) : null}
          {!effects?.confetti ? (
            <div className="mt-2 text-sm text-[var(--muted)]">Enable "Confetti" in preferences to run.</div>
          ) : null}
        </Card>

        <Card title="Preview">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col items-center gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">Ring</div>
              <div
                key={ringRun}
                className={["vc-ring", motionOff ? "" : ringRun ? "vc-ring-animate" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <svg viewBox="0 0 120 120" className="h-28 w-28">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="rgba(15,27,31,0.12)"
                    strokeWidth="10"
                  />
                  <circle
                    className="vc-ring-stroke"
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="rgba(31,111,139,0.95)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 46} ${2 * Math.PI * 46}`}
                    strokeDashoffset={`${2 * Math.PI * 46}`}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">Shimmer</div>
              <div
                key={shimmerRun}
                className={[
                  "vc-shimmer-preview rounded-2xl border border-[var(--stroke)] bg-[var(--card)]/70 p-4 text-sm text-[var(--muted)]",
                  motionOff ? "" : shimmerRun ? "vc-shimmer" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Shimmer preview card
              </div>
            </div>
          </div>
        </Card>
      </div>

      {!motionOff && effects?.confetti ? <ConfettiBurst run={confettiRun} /> : null}
    </div>
  );
}

