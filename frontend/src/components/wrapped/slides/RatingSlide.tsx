import { useEffect, useState } from "react";
import type { CfWrappedYear } from "../../../api/wrapped";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountTo(params: {
  target: number;
  isActive: boolean;
  reducedMotion: boolean;
  durationMs?: number;
}): number {
  const { target, isActive, reducedMotion, durationMs = 900 } = params;
  const [value, setValue] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (!isActive) return;
    if (reducedMotion) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, isActive, reducedMotion, target]);

  return value;
}

export function RatingSlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year, isActive, reducedMotion } = props;
  const delta = wrapped.rating.delta ?? 0;
  const shownDelta = useCountTo({ target: delta, isActive, reducedMotion, durationMs: 1100 });

  const sign = shownDelta > 0 ? "+" : "";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-75" />
      <div className="story-blob absolute -left-28 -bottom-28 h-80 w-80 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -top-32 -right-24 h-80 w-80 rounded-full bg-pink-500/28 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          Rating • {year}
        </div>

        <div className="mt-10">
          <div className="text-white/70">Year delta</div>
          <div className="story-pop mt-2 text-6xl font-semibold leading-none tracking-tight font-display">
            {sign}
            {shownDelta}
          </div>
          <div className="mt-3 text-sm text-white/70">
            Contests: <span className="font-semibold text-white">{wrapped.rating.contests}</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Start</div>
            <div className="mt-2 text-3xl font-semibold font-display">{wrapped.rating.start ?? "--"}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">End</div>
            <div className="mt-2 text-3xl font-semibold font-display">{wrapped.rating.end ?? "--"}</div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Max gain</div>
            <div className="mt-2 text-sm text-white/85">
              {wrapped.rating.maxGain
                ? `${wrapped.rating.maxGain.contestName} (${wrapped.rating.maxGain.delta >= 0 ? "+" : ""}${wrapped.rating.maxGain.delta})`
                : "--"}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Max drop</div>
            <div className="mt-2 text-sm text-white/85">
              {wrapped.rating.maxDrop
                ? `${wrapped.rating.maxDrop.contestName} (${wrapped.rating.maxDrop.delta >= 0 ? "+" : ""}${wrapped.rating.maxDrop.delta})`
                : "--"}
            </div>
          </div>
        </div>

        <div className="mt-auto text-xs uppercase tracking-[0.3em] text-white/60">
          VirtualCP Wrapped • Codeforces
        </div>
      </div>
    </div>
  );
}

