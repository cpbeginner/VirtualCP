import type { CfWrappedYear } from "../../../api/wrapped";

export function OutroSlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year } = props;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-80" />
      <div className="story-blob absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-emerald-400/28 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -top-32 -right-24 h-80 w-80 rounded-full bg-amber-400/25 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          {wrapped.handle} • {year}
        </div>

        <div className="mt-10">
          <div className="story-pop text-5xl font-semibold leading-tight tracking-tight font-display">
            That&apos;s your year.
          </div>
          <div className="mt-4 text-sm text-white/75">
            Try another year, hit refresh, or start a new virtual contest arc.
          </div>
        </div>

        <div className="mt-auto space-y-2 text-sm text-white/70">
          <div>Tap left/right to replay sections</div>
          <div>Esc to close</div>
        </div>
      </div>
    </div>
  );
}

