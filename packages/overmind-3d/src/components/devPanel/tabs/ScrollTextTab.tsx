import { SCROLL_TEXT_OFFSET_X, SCROLL_TEXT_EXIT_Z_OFFSET } from '../../../machines/timelineMachine.ts';
import type { TextElementLayout } from '../../../machines/timelineMachine.ts';
import { s } from '../styles.ts';

interface ScrollTextAlias {
  scrollProgress: number;
  visible: boolean;
  setVisible: (v: boolean) => void;
  titleLayout: TextElementLayout;
  setTitleLayout: (partial: Partial<TextElementLayout>) => void;
  subtitleLayout: TextElementLayout;
  setSubtitleLayout: (partial: Partial<TextElementLayout>) => void;
  titleFontSize: number;
  setTitleFontSize: (v: number) => void;
  subtitleFontSize: number;
  setSubtitleFontSize: (v: number) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
  subtitleColor: string;
  setSubtitleColor: (v: string) => void;
  titleEmissiveIntensity: number;
  setTitleEmissive: (v: number) => void;
  subtitleEmissiveIntensity: number;
  setSubtitleEmissive: (v: number) => void;
  importLayout: (title: TextElementLayout, subtitle: TextElementLayout) => void;
  restoreDefaults: () => void;
}

interface ScrollTextTabProps {
  scrollText: ScrollTextAlias;
  scrollTextFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ScrollTextTab({ scrollText, scrollTextFileInputRef }: ScrollTextTabProps) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Scroll Progress</h3>
        <div style={s.row}>
          <label style={s.label}>Progress: {scrollText.scrollProgress.toFixed(3)}</label>
          <input style={s.range} type="range" min={0} max={1} step={0.001}
            value={scrollText.scrollProgress}
            onChange={(e) => {
              const v = +e.target.value;
              window.dispatchEvent(new CustomEvent('overmind:scroll-progress', { detail: v }));
            }} />
          <input type="number" min={0} max={1} step={0.001}
            style={{ ...s.label, width: '70px', background: '#1e1e2e', border: '1px solid #444', borderRadius: '3px', color: '#fff', padding: '2px 4px', textAlign: 'right' as const }}
            value={scrollText.scrollProgress.toFixed(3)}
            onChange={(e) => {
              const v = Math.max(0, Math.min(1, +e.target.value));
              window.dispatchEvent(new CustomEvent('overmind:scroll-progress', { detail: v }));
            }} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Visibility</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={scrollText.visible} onChange={(e) => scrollText.setVisible(e.target.checked)} />
            Visible
          </label>
        </div>
      </div>
      {/* ── Title Position (endX/Y/Z — start & exit auto-calculated) ── */}
      <div style={s.section}>
        <h3 style={s.h3}>Title Position</h3>
        {([
          { axis: 'X' as const, min: -30, max: 30, step: 0.01 },
          { axis: 'Y' as const, min: -10, max: 20, step: 0.01 },
          { axis: 'Z' as const, min: -10, max: 30, step: 0.01 },
        ] as const).map(({ axis, min, max, step }) => {
          const endKey = `end${axis}` as 'endX' | 'endY' | 'endZ';
          const val = scrollText.titleLayout[endKey];
          return (
            <div key={axis} style={s.row}>
              <label style={s.label}>{axis}: {val.toFixed(2)}</label>
              <input style={s.range} type="range" min={min} max={max} step={step}
                value={val}
                onChange={(e) => {
                  const v = +e.target.value;
                  if (axis === 'X') {
                    scrollText.setTitleLayout({ endX: v, startX: v + SCROLL_TEXT_OFFSET_X, exitX: v });
                  } else if (axis === 'Y') {
                    scrollText.setTitleLayout({ endY: v, startY: v, exitY: v });
                  } else {
                    scrollText.setTitleLayout({ endZ: v, startZ: v, exitZ: v + SCROLL_TEXT_EXIT_Z_OFFSET });
                  }
                }} />
            </div>
          );
        })}
      </div>
      {/* ── Subtitle Position ── */}
      <div style={s.section}>
        <h3 style={s.h3}>Subtitle Position</h3>
        {([
          { axis: 'X' as const, min: -30, max: 30, step: 0.01 },
          { axis: 'Y' as const, min: -10, max: 20, step: 0.01 },
          { axis: 'Z' as const, min: -10, max: 30, step: 0.01 },
        ] as const).map(({ axis, min, max, step }) => {
          const endKey = `end${axis}` as 'endX' | 'endY' | 'endZ';
          const val = scrollText.subtitleLayout[endKey];
          return (
            <div key={axis} style={s.row}>
              <label style={s.label}>{axis}: {val.toFixed(2)}</label>
              <input style={s.range} type="range" min={min} max={max} step={step}
                value={val}
                onChange={(e) => {
                  const v = +e.target.value;
                  if (axis === 'X') {
                    scrollText.setSubtitleLayout({ endX: v, startX: v + SCROLL_TEXT_OFFSET_X, exitX: v });
                  } else if (axis === 'Y') {
                    scrollText.setSubtitleLayout({ endY: v, startY: v, exitY: v });
                  } else {
                    scrollText.setSubtitleLayout({ endZ: v, startZ: v, exitZ: v + SCROLL_TEXT_EXIT_Z_OFFSET });
                  }
                }} />
            </div>
          );
        })}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Font Sizes</h3>
        <div style={s.row}>
          <label style={s.label}>Title: {scrollText.titleFontSize.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.05"
            value={scrollText.titleFontSize}
            onChange={(e) => scrollText.setTitleFontSize(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Subtitle: {scrollText.subtitleFontSize.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.05" max="1" step="0.01"
            value={scrollText.subtitleFontSize}
            onChange={(e) => scrollText.setSubtitleFontSize(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Colors</h3>
        <div style={s.row}>
          <label style={s.label}>
            Title:
            <input style={s.colorInput} type="color"
              value={scrollText.titleColor}
              onChange={(e) => scrollText.setTitleColor(e.target.value)} />
            <span style={{ marginLeft: '6px', color: '#555', fontSize: '10px' }}>{scrollText.titleColor}</span>
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>
            Subtitle:
            <input style={s.colorInput} type="color"
              value={scrollText.subtitleColor}
              onChange={(e) => scrollText.setSubtitleColor(e.target.value)} />
            <span style={{ marginLeft: '6px', color: '#555', fontSize: '10px' }}>{scrollText.subtitleColor}</span>
          </label>
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Emissive (bloom glow)</h3>
        <div style={s.row}>
          <label style={s.label}>Title: {scrollText.titleEmissiveIntensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={scrollText.titleEmissiveIntensity}
            onChange={(e) => scrollText.setTitleEmissive(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Subtitle: {scrollText.subtitleEmissiveIntensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={scrollText.subtitleEmissiveIntensity}
            onChange={(e) => scrollText.setSubtitleEmissive(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Import / Export JSON</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={{ ...s.btnSm, flex: 1 }} onClick={async () => {
            const json = JSON.stringify({
              title: { x: scrollText.titleLayout.endX, y: scrollText.titleLayout.endY, z: scrollText.titleLayout.endZ },
              subtitle: { x: scrollText.subtitleLayout.endX, y: scrollText.subtitleLayout.endY, z: scrollText.subtitleLayout.endZ },
              titleFontSize: scrollText.titleFontSize,
              subtitleFontSize: scrollText.subtitleFontSize,
              titleColor: scrollText.titleColor,
              subtitleColor: scrollText.subtitleColor,
              titleEmissiveIntensity: scrollText.titleEmissiveIntensity,
              subtitleEmissiveIntensity: scrollText.subtitleEmissiveIntensity,
            }, null, 2);
            if ('showSaveFilePicker' in window) {
              try {
                const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
                  suggestedName: 'scroll-text-layout.json',
                  types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                return;
              } catch { /* user cancelled or API error — fall through */ }
            }
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scroll-text-layout.json';
            a.click();
            URL.revokeObjectURL(url);
          }}>Export</button>
          <button style={{ ...s.btnSm, flex: 1 }} onClick={() => scrollTextFileInputRef.current?.click()}>Import</button>
          <input ref={scrollTextFileInputRef} type="file" accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  // New simplified format: { title: {x,y,z}, subtitle: {x,y,z}, ... }
                  if (data.title && data.subtitle) {
                    const tx = data.title.x, ty = data.title.y, tz = data.title.z;
                    const sx = data.subtitle.x, sy = data.subtitle.y, sz = data.subtitle.z;
                    scrollText.setTitleLayout({ endX: tx, endY: ty, endZ: tz, startX: tx + SCROLL_TEXT_OFFSET_X, startY: ty, startZ: tz, exitX: tx + SCROLL_TEXT_OFFSET_X, exitY: ty, exitZ: tz });
                    scrollText.setSubtitleLayout({ endX: sx, endY: sy, endZ: sz, startX: sx + SCROLL_TEXT_OFFSET_X, startY: sy, startZ: sz, exitX: sx + SCROLL_TEXT_OFFSET_X, exitY: sy, exitZ: sz });
                    if (data.titleFontSize != null) scrollText.setTitleFontSize(data.titleFontSize);
                    if (data.subtitleFontSize != null) scrollText.setSubtitleFontSize(data.subtitleFontSize);
                    if (data.titleColor) scrollText.setTitleColor(data.titleColor);
                    if (data.subtitleColor) scrollText.setSubtitleColor(data.subtitleColor);
                    if (data.titleEmissiveIntensity != null) scrollText.setTitleEmissive(data.titleEmissiveIntensity);
                    if (data.subtitleEmissiveIntensity != null) scrollText.setSubtitleEmissive(data.subtitleEmissiveIntensity);
                  }
                  // Legacy full format: { titleLayout: {...}, subtitleLayout: {...} }
                  else if (data.titleLayout && data.subtitleLayout) {
                    scrollText.importLayout(data.titleLayout, data.subtitleLayout);
                  }
                } catch (err) { console.error('[DevPanel] ScrollText import error:', err); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
        </div>
      </div>
      <div style={s.section}>
        <button style={s.btnReset} onClick={scrollText.restoreDefaults}>Reset All</button>
      </div>
    </div>
  );
}
