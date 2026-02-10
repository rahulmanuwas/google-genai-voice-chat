'use client';

import { ColorPanels } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

export function ShaderBackground() {
  const [size, setSize] = useState({ width: 1280, height: 900 });

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Shader layer */}
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
          maxPixelCount={800000}
        />
      </div>

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
