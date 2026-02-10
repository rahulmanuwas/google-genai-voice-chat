const BAR_COUNT = 64;

function barHeight(i: number): number {
  // Bell curve envelope centered at midpoint, modulated by sine
  const center = BAR_COUNT / 2;
  const spread = BAR_COUNT * 0.4;
  const envelope = Math.exp(-0.5 * ((i - center) / spread) ** 2);
  const wave = Math.sin(i * 0.5) * 0.3 + Math.cos(i * 0.9) * 0.2 + 0.5;
  return 15 + envelope * wave * 85;
}

// Interpolate from amber to copper across the bars
function barColor(i: number): string {
  const t = i / (BAR_COUNT - 1);
  const hue = 38 - t * 22; // 38 → 16
  const sat = 92 - t * 17; // 92 → 75
  const light = 50 - t * 2; // 50 → 48
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function WaveVisualizer() {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Glow behind the bars */}
      <div
        className="absolute inset-x-[10%] bottom-0 h-2/3 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 80%, hsl(38 92% 50% / 0.15) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div
        className="relative flex items-end justify-center gap-[2px] sm:gap-[3px] h-28 sm:h-36"
        aria-hidden="true"
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const h = barHeight(i);
          return (
            <div
              key={i}
              className="flex-1 max-w-[6px] rounded-full"
              style={{
                height: `${h}%`,
                backgroundColor: barColor(i),
                opacity: 0.5 + (h / 100) * 0.5,
                animation: `wave-bar ${1.4 + (i % 7) * 0.15}s ease-in-out ${i * 0.03}s infinite`,
                transformOrigin: 'bottom',
              }}
            />
          );
        })}
      </div>

      {/* Reflection */}
      <div
        className="relative flex items-start justify-center gap-[2px] sm:gap-[3px] h-10 sm:h-14 opacity-[0.12]"
        style={{ transform: 'scaleY(-1)', maskImage: 'linear-gradient(to bottom, white, transparent)' }}
        aria-hidden="true"
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const h = barHeight(i);
          return (
            <div
              key={i}
              className="flex-1 max-w-[6px] rounded-full"
              style={{
                height: `${h}%`,
                backgroundColor: barColor(i),
                animation: `wave-bar ${1.4 + (i % 7) * 0.15}s ease-in-out ${i * 0.03}s infinite`,
                transformOrigin: 'bottom',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
