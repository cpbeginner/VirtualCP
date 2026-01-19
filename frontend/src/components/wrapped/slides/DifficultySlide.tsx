import type { CfWrappedYear } from "../../../api/wrapped";

export function DifficultySlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year } = props;

  const counts = wrapped.problems.difficultyCounts;
  const maxCount = counts.reduce((m, c) => Math.max(m, c.count), 0);
  const summary = wrapped.problems.difficultySummary;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-80" />
      <div className="story-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/32 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -bottom-40 -right-24 h-80 w-80 rounded-full bg-lime-300/20 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          Difficulty • {year}
        </div>

        <div className="mt-8">
          <div className="story-pop text-4xl font-semibold tracking-tight font-display">
            Level curve
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Min</div>
              <div className="mt-2 text-2xl font-semibold font-display">{summary.min ?? "--"}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Median</div>
              <div className="mt-2 text-2xl font-semibold font-display">
                {summary.median ?? "--"}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Max</div>
              <div className="mt-2 text-2xl font-semibold font-display">{summary.max ?? "--"}</div>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-2">
          {counts.length ? (
            counts.slice(0, 8).map((c) => (
              <div key={c.rating} className="flex items-center gap-3">
                <div className="w-14 text-xs font-semibold text-white/80">{c.rating}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{
                      width: `${maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="w-8 text-right text-xs font-semibold text-white/70">{c.count}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-white/70">No difficulty data available.</div>
          )}
        </div>

        <div className="mt-auto text-xs uppercase tracking-[0.3em] text-white/60">
          VirtualCP Wrapped • Codeforces
        </div>
      </div>
    </div>
  );
}

