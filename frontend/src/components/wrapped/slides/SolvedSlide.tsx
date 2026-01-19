import { useEffect, useState } from "react";
import type { CfWrappedYear } from "../../../api/wrapped";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(params: {
  target: number;
  isActive: boolean;
  reducedMotion: boolean;
  durationMs?: number;
}): number {
  const { target, isActive, reducedMotion, durationMs = 800 } = params;
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

export function SolvedSlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year, isActive, reducedMotion } = props;
  const big = useCountUp({
    target: wrapped.problems.uniqueSolved,
    isActive,
    reducedMotion,
    durationMs: 900,
  });
  const ac = useCountUp({
    target: wrapped.problems.acSubmissions,
    isActive,
    reducedMotion,
    durationMs: 900,
  });

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-80" />
      <div className="story-blob absolute -left-24 top-10 h-64 w-64 rounded-full bg-indigo-500/35 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-emerald-400/30 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          Solves in {year}
        </div>

        <div className="mt-10">
          <div className="text-white/70">Unique solved</div>
          <div className="story-pop mt-2 text-6xl font-semibold leading-none tracking-tight font-display">
            {big}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">AC submissions</div>
            <div className="mt-2 text-3xl font-semibold font-display">{ac}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Active days</div>
            <div className="mt-2 text-3xl font-semibold font-display">{wrapped.problems.activeDays}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Longest streak</div>
            <div className="mt-2 text-3xl font-semibold font-display">
              {wrapped.problems.longestStreakDays}d
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">First solve</div>
            <div className="mt-2 text-sm text-white/80">
              {wrapped.problems.firstSolvedAt
                ? new Date(wrapped.problems.firstSolvedAt * 1000).toISOString().slice(0, 10)
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

