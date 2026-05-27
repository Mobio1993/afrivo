const DOTS = [
  { size: 350, top: -15, left: -12, opacity: 0.05 },
  { size: 200, top: 60, left: 55, opacity: 0.04 },
  { size: 150, top: -8, left: 75, opacity: 0.03 },
  { size: 8, top: 22, left: 44, opacity: 0.3 },
  { size: 5, top: 46, left: 26, opacity: 0.22 },
  { size: 6, top: 68, left: 18, opacity: 0.18 },
  { size: 4, top: 30, left: 62, opacity: 0.2 },
  { size: 7, top: 55, left: 38, opacity: 0.25 },
  { size: 5, top: 78, left: 52, opacity: 0.15 },
  { size: 6, top: 14, left: 82, opacity: 0.2 },
];

export default function PlAnimatedBackground() {
  return (
    <div className="pl-bg" aria-hidden="true">
      {DOTS.map((dot, index) => (
        <div
          key={`${dot.size}-${dot.top}-${dot.left}`}
          className="pl-bg-dot"
          style={{
            width: dot.size,
            height: dot.size,
            top: `${dot.top}%`,
            left: `${dot.left}%`,
            "--pl-dot-opacity": dot.opacity,
            animationDelay: `${index * 0.4}s`,
          }}
        />
      ))}
      <div className="pl-bg-grid" />
    </div>
  );
}

