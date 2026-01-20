import { useEffect } from "react";

export function GlowCursor() {
  useEffect(() => {
    const root = document.documentElement;

    function onMove(e: MouseEvent) {
      root.style.setProperty("--vc-cursor-x", `${e.clientX}px`);
      root.style.setProperty("--vc-cursor-y", `${e.clientY}px`);
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return <div className="vc-glow-cursor pointer-events-none fixed inset-0 z-0" />;
}

