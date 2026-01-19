import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CfWrappedYear } from "../../api/wrapped";
import { IntroSlide } from "./slides/IntroSlide";
import { SolvedSlide } from "./slides/SolvedSlide";
import { TagsSlide } from "./slides/TagsSlide";
import { DifficultySlide } from "./slides/DifficultySlide";
import { RatingSlide } from "./slides/RatingSlide";
import { OutroSlide } from "./slides/OutroSlide";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mql) return;
    const update = () => setReduced(!!mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

export function StoryPlayer(props: {
  wrapped: CfWrappedYear;
  year: number;
  onClose: () => void;
}) {
  const { wrapped, year, onClose } = props;

  const reducedMotion = usePrefersReducedMotion();
  const durationMs = 6500;

  const slides = useMemo(
    () => [
      { key: "intro", Comp: IntroSlide },
      { key: "solved", Comp: SolvedSlide },
      { key: "tags", Comp: TagsSlide },
      { key: "difficulty", Comp: DifficultySlide },
      { key: "rating", Comp: RatingSlide },
      { key: "outro", Comp: OutroSlide },
    ],
    [],
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressMs, setProgressMs] = useState(0);

  const progressRef = useRef(progressMs);
  progressRef.current = progressMs;

  useEffect(() => {
    if (reducedMotion) setPaused(true);
  }, [reducedMotion]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
    setProgressMs(0);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    setProgressMs(0);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return;

    let raf = 0;
    const start = performance.now() - progressRef.current;

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        if (index < slides.length - 1) {
          setIndex((i) => Math.min(slides.length - 1, i + 1));
          setProgressMs(0);
        } else {
          setProgressMs(durationMs);
          setPaused(true);
        }
        return;
      }

      setProgressMs(elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, index, paused, reducedMotion, slides.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        goNext();
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (!reducedMotion) togglePause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose, reducedMotion, togglePause]);

  const Comp = slides[index].Comp;

  const fillPercent = (i: number): number => {
    if (i < index) return 100;
    if (i > index) return 0;
    if (reducedMotion) return 0;
    return Math.max(0, Math.min(100, (progressMs / durationMs) * 100));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-black shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
        style={{ aspectRatio: "9 / 16" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          const el = e.currentTarget as HTMLElement;
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 3) {
            goPrev();
          } else if (x > (rect.width * 2) / 3) {
            goNext();
          } else if (!reducedMotion) {
            togglePause();
          }
        }}
      >
        <div className="absolute left-0 right-0 top-0 z-10 p-3">
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-white" style={{ width: `${fillPercent(i)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              {wrapped.handle} • {year}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/15"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!reducedMotion) togglePause();
                }}
              >
                {paused || reducedMotion ? "Play" : "Pause"}
              </button>
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/15"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="absolute inset-0">
          <Comp wrapped={wrapped} year={year} isActive={true} reducedMotion={reducedMotion} />
        </div>
      </div>
    </div>
  );
}
