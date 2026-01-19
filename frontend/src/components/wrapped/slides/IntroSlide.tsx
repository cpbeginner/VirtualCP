import type { CfWrappedYear } from "../../../api/wrapped";

export function IntroSlide(props: {
  wrapped: CfWrappedYear;
  year: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const { wrapped, year } = props;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070A13] text-white">
      <div className="absolute inset-0 story-gradient opacity-80" />
      <div className="story-blob absolute -left-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/40 blur-3xl" />
      <div className="story-blob story-blob-slow absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-cyan-400/35 blur-3xl" />
      <div className="story-blob absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-400/25 blur-3xl" />

      <div className="relative flex h-full flex-col p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
          VirtualCP
        </div>

        <div className="mt-8">
          <div className="story-pop text-4xl font-semibold leading-tight tracking-tight font-display">
            Codeforces Wrapped
          </div>
          <div className="mt-3 text-lg text-white/80">
            @{wrapped.handle} • {year}
          </div>
        </div>

        <div className="mt-auto space-y-2 text-sm text-white/70">
          <div>Tap left/right to navigate</div>
          <div>Space to pause • Esc to close</div>
        </div>
      </div>
    </div>
  );
}

