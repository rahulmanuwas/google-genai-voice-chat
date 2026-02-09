export function DotGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Dot pattern — finer, subtler */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle, hsl(200 80% 55%) 0.75px, transparent 0.75px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Primary glow — large diffused teal, top-center */}
      <div
        className="absolute left-1/2 top-[20%] h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(200 80% 55% / 0.12) 0%, hsl(200 80% 55% / 0.04) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'pulse-glow 8s ease-in-out infinite',
        }}
      />

      {/* Secondary glow — offset purple for depth */}
      <div
        className="absolute left-[30%] top-[60%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(260 60% 50% / 0.06) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'pulse-glow 10s ease-in-out 2s infinite',
        }}
      />

      {/* Tertiary glow — green accent, bottom right */}
      <div
        className="absolute right-[20%] top-[70%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(160 60% 45% / 0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'pulse-glow 12s ease-in-out 4s infinite',
        }}
      />
    </div>
  );
}
