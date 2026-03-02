import type { useScene } from '../../../hooks/useScene.ts';
import type { CameraKeyframe } from '../../../machines/timelineMachine.ts';
import type { EasingType } from '../../../utils/easing.ts';
import { EASING_OPTIONS } from '../../../utils/easing.ts';
import { s } from '../styles.ts';

interface CamKfAlias {
  scrollProgress: number;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  keyframes: CameraKeyframe[];
  updateKeyframe: (i: number, kf: CameraKeyframe) => void;
  deleteKeyframe: (i: number) => void;
  importKeyframes: (data: CameraKeyframe[]) => void;
  restoreDefaults: () => void;
}

interface CamPathTabProps {
  camKf: CamKfAlias;
  scene: ReturnType<typeof useScene>;
  cameraMode: 'free' | 'scroll';
  capturedAt: number | null;
  camKfFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function CamPathTab({ camKf, scene, cameraMode, capturedAt, camKfFileInputRef }: CamPathTabProps) {
  return (
    <div>
      {/* Camera mode indicator */}
      <div style={{
        ...s.section,
        background: cameraMode === 'free' ? 'rgba(59,130,246,0.15)' : 'transparent',
        border: cameraMode === 'free' ? '1px solid rgba(59,130,246,0.4)' : 'none',
        borderRadius: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 'bold',
            color: cameraMode === 'free' ? '#60a5fa' : '#888',
          }}>
            {cameraMode === 'free' ? 'FREE CAMERA' : 'SCROLL-DRIVEN'}
          </span>
          <span style={{ fontSize: '9px', color: '#666' }}>
            [F] toggle &middot; [K] capture
          </span>
        </div>
        {cameraMode === 'free' && (
          <button style={s.btnPrimary} onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
          }}>
            Capture Keyframe at progress={camKf.scrollProgress.toFixed(3)}
          </button>
        )}
        {capturedAt !== null && (
          <div style={{ marginTop: '4px', fontSize: '10px', color: '#4ade80' }}>
            Keyframe captured at {capturedAt.toFixed(3)}
          </div>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Keyframe Control</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={camKf.enabled} onChange={(e) => camKf.setEnabled(e.target.checked)} />
            Enable Keyframe Control
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Scroll Progress: {camKf.scrollProgress.toFixed(3)}</label>
          <input style={s.range} type="range" min={0} max={1} step={0.001}
            value={camKf.scrollProgress}
            onChange={(e) => {
              const v = +e.target.value;
              window.dispatchEvent(new CustomEvent('overmind:scroll-progress', { detail: v }));
            }} />
          <input type="number" min={0} max={1} step={0.001}
            style={{ ...s.label, width: '70px', background: '#1e1e2e', border: '1px solid #444', borderRadius: '3px', color: '#fff', padding: '2px 4px', textAlign: 'right' as const }}
            value={camKf.scrollProgress.toFixed(3)}
            onChange={(e) => {
              const v = Math.max(0, Math.min(1, +e.target.value));
              window.dispatchEvent(new CustomEvent('overmind:scroll-progress', { detail: v }));
            }} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Keyframes ({camKf.keyframes.length})</h3>
        {camKf.keyframes.length === 0 ? (
          <p style={{ margin: 0, color: '#444', fontSize: '10px' }}>Aucun keyframe</p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {camKf.keyframes.map((kf, i) => (
              <div key={i} style={{
                padding: '5px 0',
                borderBottom: '1px solid #1a1a1a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>
                    at={kf.at.toFixed(3)}
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button style={s.btnSm} onClick={() => {
                      window.dispatchEvent(new CustomEvent('overmind:scroll-progress', { detail: kf.at }));
                    }} title="Aller a ce scroll">Go</button>
                    <button style={{ ...s.btnSm, color: '#f59e0b' }} onClick={() => {
                      camKf.updateKeyframe(i, {
                        ...kf,
                        posX: scene.cameraX,
                        posY: scene.cameraY,
                        posZ: scene.cameraZ,
                        lookAtX: scene.lookAtX,
                        lookAtY: scene.lookAtY,
                        lookAtZ: scene.lookAtZ,
                        fov: scene.fov,
                      });
                    }} title="Recapturer pos/lookAt/fov depuis Scene">Rec</button>
                    <button style={{ ...s.btnSm, color: '#ef4444' }} onClick={() => camKf.deleteKeyframe(i)} title="Supprimer">Del</button>
                  </div>
                </div>
                <div style={{ fontSize: '9px', color: '#666', lineHeight: 1.6 }}>
                  pos({kf.posX.toFixed(1)}, {kf.posY.toFixed(1)}, {kf.posZ.toFixed(1)})
                  {' '}lookAt({kf.lookAtX.toFixed(1)}, {kf.lookAtY.toFixed(1)}, {kf.lookAtZ.toFixed(1)})
                  {' '}fov={kf.fov.toFixed(0)}
                </div>
                <div style={{ marginTop: '3px' }}>
                  <select style={{ ...s.select, width: 'auto', fontSize: '10px' }}
                    value={kf.easing}
                    onChange={(e) => camKf.updateKeyframe(i, { ...kf, easing: e.target.value as EasingType })}>
                    {EASING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Import / Export JSON</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={{ ...s.btnSm, flex: 1 }} onClick={async () => {
            const json = JSON.stringify(camKf.keyframes, null, 2);
            if ('showSaveFilePicker' in window) {
              try {
                const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
                  suggestedName: 'camera-keyframes.json',
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
            a.download = 'camera-keyframes.json';
            a.click();
            URL.revokeObjectURL(url);
          }}>Export</button>
          <button style={{ ...s.btnSm, flex: 1 }} onClick={() => camKfFileInputRef.current?.click()}>Import</button>
          <input ref={camKfFileInputRef} type="file" accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  if (Array.isArray(data)) camKf.importKeyframes(data);
                } catch (err) { console.error('[DevPanel] CamPath import error:', err); }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
        </div>
      </div>
      <div style={s.section}>
        <button style={s.btnReset} onClick={camKf.restoreDefaults}>Reset All</button>
      </div>
    </div>
  );
}
