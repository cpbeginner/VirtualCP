import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number };

export function ParticlesBackdrop(props: { density?: number }) {
  const { density = 46 } = props;
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      w = Math.floor(window.innerWidth * dpr);
      h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const n = Math.max(12, Math.floor(density));
      particles = Array.from({ length: n }, () => {
        const r = (2 + Math.random() * 3) * dpr;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r,
          vx: (-0.18 + Math.random() * 0.36) * dpr,
          vy: (0.08 + Math.random() * 0.22) * dpr,
          a: 0.08 + Math.random() * 0.14,
        };
      });
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y > h + 50) p.y = -50;

        ctx.beginPath();
        ctx.fillStyle = `rgba(31, 111, 139, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(tick);
    }

    resize();
    tick();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, [density]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" />;
}

