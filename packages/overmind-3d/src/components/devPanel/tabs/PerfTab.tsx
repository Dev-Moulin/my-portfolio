import type { usePerformance } from '../../../hooks/usePerformance.ts';
import { s } from '../styles.ts';

export function PerfTab({ perf }: { perf: ReturnType<typeof usePerformance> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Monitoring</h3>
        {!perf.isMonitoring ? (
          <button style={s.btnPrimary} onClick={perf.startMonitoring}>Start Monitoring</button>
        ) : (
          <button style={s.btnDanger} onClick={perf.stopMonitoring}>Stop Monitoring</button>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>FPS</h3>
        <div style={s.statGrid}>
          <span style={s.statLabel}>Current:</span>
          <span style={s.statVal}>{perf.fps.toFixed(1)}</span>
          <span style={s.statLabel}>Avg:</span>
          <span style={s.statVal}>
            {perf.fpsHistory.length > 0
              ? (perf.fpsHistory.reduce((a: number, b: number) => a + b, 0) / perf.fpsHistory.length).toFixed(1)
              : '--'}
          </span>
          <span style={s.statLabel}>Min:</span>
          <span style={s.statVal}>
            {perf.fpsHistory.length > 0 ? Math.min(...perf.fpsHistory).toFixed(1) : '--'}
          </span>
          <span style={s.statLabel}>Max:</span>
          <span style={s.statVal}>
            {perf.fpsHistory.length > 0 ? Math.max(...perf.fpsHistory).toFixed(1) : '--'}
          </span>
        </div>
        <button style={s.btnReset} onClick={perf.clearHistory} disabled={!perf.isMonitoring}>
          Clear History
        </button>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Memory</h3>
        <div style={s.statGrid}>
          <span style={s.statLabel}>Used:</span>
          <span style={s.statVal}>{perf.memoryUsed.toFixed(1)} MB</span>
          <span style={s.statLabel}>Limit:</span>
          <span style={s.statVal}>{perf.memoryLimit.toFixed(1)} MB</span>
          <span style={s.statLabel}>Usage:</span>
          <span style={{
            ...s.statVal,
            color: perf.memoryUsedPercent > 80 ? '#f87171' : '#4ade80',
          }}>
            {perf.memoryUsedPercent}%
          </span>
        </div>
        <div style={s.progressWrap}>
          <div style={{
            height: '100%',
            width: `${perf.memoryUsedPercent}%`,
            background: perf.memoryUsedPercent > 80 ? '#ef4444' : '#22c55e',
            borderRadius: '2px',
            transition: 'width 0.4s',
          }} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Renderer</h3>
        <div style={s.statGrid}>
          <span style={s.statLabel}>Triangles:</span>
          <span style={s.statVal}>{perf.rendererInfo.triangles.toLocaleString()}</span>
          <span style={s.statLabel}>Geometries:</span>
          <span style={s.statVal}>{perf.rendererInfo.geometries}</span>
          <span style={s.statLabel}>Textures:</span>
          <span style={s.statVal}>{perf.rendererInfo.textures}</span>
          <span style={s.statLabel}>Programs:</span>
          <span style={s.statVal}>{perf.rendererInfo.programs}</span>
          <span style={s.statLabel}>Draw Calls:</span>
          <span style={s.statVal}>{perf.rendererInfo.calls}</span>
        </div>
      </div>
    </div>
  );
}
