import { useEffect, useRef } from "react";

type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
};

const COLORS = ["#f6ae2d", "#1f6f8b", "#d1495b", "#1b8a5a", "#6366f1", "#ec4899"];

export function ConfettiBurst(props: { run: number; onDone?: () => void }) {
  const { run, onDone } = props;
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let pieces: Confetti[] = [];

    function resize() {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      w = Math.floor(window.innerWidth * dpr);
      h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }

    resize();

    const originX = w * 0.5;
    const originY = h * 0.35;
    pieces = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 6) * dpr;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5 * dpr,
        size: (4 + Math.random() * 6) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (-0.18 + Math.random() * 0.36) * dpr,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    const started = performance.now();
    const durationMs = 1400;

    function tick(t: number) {
      const elapsed = t - started;
      ctx.clearRect(0, 0, w, h);

      for (const c of pieces) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.12 * dpr;
        c.vx *= 0.99;
        c.rot += c.vr;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        ctx.restore();
      }

      if (elapsed < durationMs) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        onDone?.();
      }
    }

    raf = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, [run, onDone]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" />;
}

