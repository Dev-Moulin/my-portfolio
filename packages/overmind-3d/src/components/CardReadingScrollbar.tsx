import { useEffect, useState } from 'react';

interface ReadingDetail {
  active: boolean;
  cardIdx: number | null;
  offset: number;       // 0..1
  viewportFrac: number; // 0..1
}

const INITIAL: ReadingDetail = { active: false, cardIdx: null, offset: 0, viewportFrac: 0 };

export function CardReadingScrollbar() {
  const [detail, setDetail] = useState<ReadingDetail>(INITIAL);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<ReadingDetail>).detail;
      setDetail(d);
    };
    window.addEventListener('overmind:reading-mode', handler);
    return () => window.removeEventListener('overmind:reading-mode', handler);
  }, []);

  if (!detail.active) return null;

  const viewportFrac = Math.max(0.05, Math.min(1, detail.viewportFrac || 0.34));
  const thumbPct = viewportFrac * 100;
  const maxOffset = Math.max(0.0001, 1 - viewportFrac);
  const topPct = (detail.offset / maxOffset) * (100 - thumbPct);

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: '20%',
        bottom: '20%',
        width: 6,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${topPct}%`,
          height: `${thumbPct}%`,
          background: '#00d4ff',
          borderRadius: 3,
          boxShadow: '0 0 8px #00d4ff80',
          transition: 'top 60ms linear',
        }}
      />
    </div>
  );
}
