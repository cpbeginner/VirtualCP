import type { CfWrappedYear } from "../../../api/wrapped";

export function TagsSlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year } = props;
  const tags = wrapped.problems.topTags.slice(0, 8);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-75" />
      <div className="story-blob absolute -left-28 -top-28 h-72 w-72 rounded-full bg-rose-500/35 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-sky-400/30 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          Top tags • {year}
        </div>

        <div className="mt-8">
          <div className="story-pop text-4xl font-semibold tracking-tight font-display">
            Your patterns
          </div>
          <div className="mt-2 text-sm text-white/70">
            Based on earliest AC per problem in the year.
          </div>
        </div>

        <div className="mt-10 space-y-3">
          {tags.length ? (
            tags.map((t) => (
              <div
                key={t.tag}
                className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
              >
                <div className="text-sm font-semibold">{t.tag}</div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                  {t.count}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-white/70">No tag data available.</div>
          )}
        </div>

        <div className="mt-auto text-xs uppercase tracking-[0.3em] text-white/60">
          VirtualCP Wrapped • Codeforces
        </div>
      </div>
    </div>
  );
}

