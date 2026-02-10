'use client';

import { ColorPanels } from '@paper-design/shaders-react';
import { useEffect, useRef, useState } from 'react';

export function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 1280, height: 900 });

  // Only render the WebGL shader when the hero is in the viewport.
  // Unmounting destroys the GL context and frees VRAM.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Debounced resize so we don't churn the GL canvas on every pixel.
  useEffect(() => {
    let raf: number;
    function update() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    }
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Shader layer — only mounted while in viewport */}
      {visible && (
        <div style={{ opacity: 0.45 }}>
          <ColorPanels
            width={size.width}
            height={size.height}
            colors={[
              '#ff9d00',
              '#e8652e',
              '#cc7700',
              '#3a1f8e',
              '#ffb830',
            ]}
            colorBack="#000000"
            density={2.5}
            angle1={0.1}
            angle2={-0.05}
            length={1.3}
            edges={false}
            blur={0.12}
            fadeIn={1}
            fadeOut={0.35}
            gradient={0.35}
            speed={0.15}
            scale={0.75}
            minPixelRatio={1}
            maxPixelCount={400000}
          />
        </div>
      )}

      {/* Radial dark overlay — keeps center text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
