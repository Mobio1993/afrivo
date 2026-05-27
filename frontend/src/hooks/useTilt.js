import { useEffect, useRef } from "react";

export function useTilt(maxTilt = 7) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onEnter() {
      el.style.transition = "transform 0.22s ease";
      el.style.transform = "perspective(700px) translateZ(5px)";
    }

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transition = "transform 0.08s linear";
      el.style.transform = `perspective(700px) rotateX(${(-y * maxTilt * 2).toFixed(2)}deg) rotateY(${(x * maxTilt * 2).toFixed(2)}deg) translateZ(8px)`;
      el.style.setProperty("--mx", `${(e.clientX - rect.left).toFixed(0)}px`);
      el.style.setProperty("--my", `${(e.clientY - rect.top).toFixed(0)}px`);
      el.style.setProperty("--spotlight", "1");
    }

    function onLeave() {
      el.style.transition = "transform 0.5s cubic-bezier(0.34, 1.15, 0.64, 1)";
      el.style.transform = "";
      el.style.setProperty("--spotlight", "0");
      el.addEventListener("transitionend", () => { el.style.transition = ""; }, { once: true });
    }

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [maxTilt]);

  return ref;
}
