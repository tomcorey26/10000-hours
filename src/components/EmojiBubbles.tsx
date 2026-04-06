const BUBBLE_EMOJIS = [
  "🎉", "⭐", "🔥", "💪", "✨", "🏆", "🎯", "💥", "🙌", "👏",
];

export function EmojiBubbles() {
  const bubbles = Array.from({ length: 14 }, (_, i) => ({
    emoji: BUBBLE_EMOJIS[i % BUBBLE_EMOJIS.length],
    left: `${5 + ((i * 7) % 90)}%`,
    duration: 2.5 + (i % 4) * 0.6,
    delay: (i % 7) * 0.4,
    size: 1.2 + (i % 3) * 0.5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-0"
          style={{
            left: b.left,
            fontSize: `${b.size}rem`,
            animation: `bubble-up ${b.duration}s ease-out ${0.4 + b.delay}s infinite`,
            opacity: 0,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
