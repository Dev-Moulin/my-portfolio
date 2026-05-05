import { useEffect, useState } from 'react';

interface GaugeUpdateDetail {
  value: number;       // -1..+1
  state: 'dwell' | 'playing' | 'free';
  currentPoint: 'A' | 'B' | 'C' | 'D';
  canGoForward: boolean;
  canGoBackward: boolean;
}

const DEFAULT_DETAIL: GaugeUpdateDetail = {
  value: 0,
  state: 'dwell',
  currentPoint: 'A',
  canGoForward: true,
  canGoBackward: false,
};

const HEIGHT = 240;
const HALF = HEIGHT / 2;

export function ScrollGaugeOverlay() {
  const [detail, setDetail] = useState<GaugeUpdateDetail>(DEFAULT_DETAIL);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<GaugeUpdateDetail>).detail;
      setDetail(d);
    };
    window.addEventListener('overmind:scroll-gauge-update', handler);
    return () => window.removeEventListener('overmind:scroll-gauge-update', handler);
  }, []);

  const visible = detail.state === 'dwell';
  const value = Math.max(-1, Math.min(1, detail.value));
  const fillHeight = Math.abs(value) * HALF;

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 14,
        height: HEIGHT,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.15)',
        pointerEvents: 'none',
        zIndex: 100,
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Top edge (forward zone) */}
      <div style={{
        position: 'absolute',
        top: 4,
        bottom: HALF + 1,
        left: 4,
        right: 4,
        background: detail.canGoForward ? 'rgba(255,255,255,0.04)' : 'rgba(80,80,80,0.15)',
        borderRadius: 4,
      }} />
      {/* Bottom edge (backward zone) */}
      <div style={{
        position: 'absolute',
        top: HALF + 1,
        bottom: 4,
        left: 4,
        right: 4,
        background: detail.canGoBackward ? 'rgba(255,255,255,0.04)' : 'rgba(80,80,80,0.15)',
        borderRadius: 4,
      }} />
      {/* Center neutral line */}
      <div style={{
        position: 'absolute',
        top: HALF - 0.5,
        left: 2,
        right: 2,
        height: 1,
        background: 'rgba(255,255,255,0.4)',
      }} />
      {/* Forward fill (value > 0) */}
      {value > 0 && (
        <div style={{
          position: 'absolute',
          left: 4,
          right: 4,
          bottom: HALF,
          height: fillHeight,
          background: 'linear-gradient(to top, #4dd0e1, #00bcd4)',
          borderRadius: 4,
          transition: 'height 80ms linear',
          boxShadow: '0 0 8px rgba(0,188,212,0.6)',
        }} />
      )}
      {/* Backward fill (value < 0) */}
      {value < 0 && (
        <div style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: HALF,
          height: fillHeight,
          background: 'linear-gradient(to bottom, #ffb74d, #ff9800)',
          borderRadius: 4,
          transition: 'height 80ms linear',
          boxShadow: '0 0 8px rgba(255,152,0,0.6)',
        }} />
      )}
      {/* Current point label */}
      <div style={{
        position: 'absolute',
        top: HEIGHT + 8,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'monospace',
        letterSpacing: 1,
      }}>
        {detail.currentPoint}
      </div>
    </div>
  );
}
