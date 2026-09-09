'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createGlassRenderer } from '@/lib/glass-renderer';

const HEX = '0123456789ABCDEF';
const CIPHER = Array.from({ length: 40 }, (_, row) =>
  Array.from({ length: 44 }, (_, col) => HEX[(row * 11 + col * 7 + row * col) % 16]).join(''),
).join('\n');

export default function Home() {
  const surface = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createGlassRenderer> | null>(null);
  const position = useRef({ x: .5, y: .5 });
  const drag = useRef({ id: null as number | null, x: 0, y: 0, startX: 0, startY: 0, spun: false });

  useEffect(() => {
    if (!canvas.current || !surface.current) return;
    const button = surface.current;
    renderer.current = createGlassRenderer(canvas.current,
      (ready) => { button.dataset.renderer = ready ? 'webgl' : 'fallback'; },
      (yaw, pitch) => {
        button.style.setProperty('--yaw', `${yaw}rad`);
        button.style.setProperty('--pitch', `${pitch}rad`);
      },
    );
    const reset = () => {
      const id = drag.current.id;
      drag.current.id = null;
      if (id !== null && button.hasPointerCapture(id)) button.releasePointerCapture(id);
      button.removeAttribute('data-dragging');
      renderer.current?.stop();
      button.style.setProperty('--presence', '0');
    };
    window.addEventListener('blur', reset);
    const onVisibility = () => { if (document.hidden) reset(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, []);

  function reveal(x: number, y: number) {
    position.current = { x, y };
    const inside = Math.hypot(x - .5, y - .5) <= .415;
    const button = surface.current;
    button?.style.setProperty('--lens-x', `${x * 100}%`);
    button?.style.setProperty('--lens-y', `${y * 100}%`);
    button?.style.setProperty('--presence', inside ? '1' : '0');
    renderer.current?.move(x, y, inside);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (drag.current.id !== null && event.pointerId !== drag.current.id)) return;
    if (event.pointerType === 'touch' && drag.current.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (drag.current.id === event.pointerId) {
      const gesture = drag.current;
      if (gesture.spun || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 4) {
        gesture.spun = true;
        renderer.current?.drag((event.clientX - gesture.x) / rect.width, (event.clientY - gesture.y) / rect.height);
        gesture.x = event.clientX;
        gesture.y = event.clientY;
      }
    }
    reveal((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }

  function hide() {
    surface.current?.style.setProperty('--presence', '0');
    renderer.current?.hide();
  }

  function cancelDrag() {
    const id = drag.current.id;
    drag.current.id = null;
    surface.current?.removeAttribute('data-dragging');
    if (id !== null && surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
    renderer.current?.stop();
    hide();
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-.035, 0], ArrowRight: [.035, 0], ArrowUp: [0, -.035], ArrowDown: [0, .035],
    };
    if (event.key === 'Escape') { cancelDrag(); return; }
    if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      renderer.current?.turn(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      reveal(.5, .5);
      return;
    }
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    reveal(Math.max(.1, Math.min(.9, position.current.x + step[0])), Math.max(.09, Math.min(.9, position.current.y + step[1])));
  }

  return (
    <main className="landing" aria-label="Glasscoins Protocol">
      <button
        ref={surface}
        className="coin-surface"
        type="button"
        aria-label="Glass Bitcoin. Hover to reveal encrypted characters. Drag to spin; release for momentum. Use arrow keys to move the lens, or Shift and left or right arrow to spin."
        onPointerEnter={move}
        onPointerMove={move}
        onPointerLeave={() => { if (drag.current.id === null) hide(); }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || drag.current.id !== null) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, spun: false };
          event.currentTarget.dataset.dragging = 'true';
          renderer.current?.startDrag();
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerUp={(event) => {
          if (drag.current.id !== event.pointerId) return;
          drag.current.id = null;
          event.currentTarget.removeAttribute('data-dragging');
          renderer.current?.endDrag();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (event.pointerType === 'touch') hide();
          else move(event);
        }}
        onPointerCancel={(event) => { if (drag.current.id === event.pointerId) cancelDrag(); }}
        onLostPointerCapture={() => {
          if (drag.current.id !== null) cancelDrag();
        }}
        onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) reveal(.5, .5); }}
        onBlur={cancelDrag}
        onKeyDown={keyboard}
      >
        <span className="fallback" aria-hidden="true">
          <img className="coin-image" src="/images/glass-bitcoin.png" alt="" width="1254" height="1254" fetchPriority="high" draggable={false} />
          <span className="fallback-lens"><img className="coin-image" src="/images/glass-bitcoin.png" alt="" width="1254" height="1254" draggable={false} /></span>
          <span className="fallback-cipher"><span>{CIPHER}</span></span>
        </span>
        <canvas ref={canvas} className="glass-canvas" aria-hidden="true" />
      </button>
      <svg className="filter-defs" aria-hidden="true">
        <defs>
          <filter id="fallback-liquid" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency=".016 .024" numOctaves="2" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </main>
  );
}
