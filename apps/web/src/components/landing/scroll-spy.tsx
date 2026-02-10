'use client';

import { useEffect } from 'react';

/**
 * Watches all <section id="..."> elements on the page and updates
 * the URL hash as the user scrolls through them.
 */
export function ScrollSpy() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('section[id]');
    if (sections.length === 0) return;

    let current = '';

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost visible section
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id && id !== current) {
              current = id;
              history.replaceState(null, '', `#${id}`);
            }
            break;
          }
        }
      },
      {
        // Fire when the top ~40% of viewport intersects a section
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return null;
}
