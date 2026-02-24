// src/components/DevControlPanel.tsx
import { useState, useRef, useEffect } from 'react';
import type { ActorRefFrom } from 'xstate';
import { useOvermind } from '../hooks/useOvermind.ts';
import { useBloom } from '../hooks/useBloom.ts';
import { useLighting } from '../hooks/useLighting.ts';
import { usePBR } from '../hooks/usePBR.ts';
import { useMaterial } from '../hooks/useMaterial.ts';
import { useScene } from '../hooks/useScene.ts';
import { usePerformance } from '../hooks/usePerformance.ts';
import { useRevelation } from '../hooks/useRevelation.ts';
import { useModel } from '../hooks/useModel.ts';
import { useVisualPreset } from '../hooks/useVisualPreset.ts';
import { useNeonBands } from '../hooks/useNeonBands.ts';
import { useSteering } from '../hooks/useSteering.ts';
import { useScrollText } from '../hooks/useScrollText.ts';
import { useCameraKeyframes } from '../hooks/useCameraKeyframes.ts';
import { useScrollCard } from '../hooks/useScrollCard.ts';
import type { bloomMachine } from '../machines/bloomMachine.ts';
import type { lightingMachine } from '../machines/lightingMachine.ts';
import type { pbrMachine } from '../machines/pbrMachine.ts';
import type { materialMachine } from '../machines/materialMachine.ts';
import type { sceneMachine } from '../machines/sceneMachine.ts';
import type { performanceMonitor } from '../machines/performanceMachine.ts';
import type { revelationMachine } from '../machines/revelationMachine.ts';
import type { modelMachine } from '../machines/modelMachine.ts';
import type { visualPresetMachine } from '../machines/visualPresetMachine.ts';
import type { neonBandsMachine } from '../machines/neonBandsMachine.ts';
import type { steeringMachine } from '../machines/steeringMachine.ts';
import type { scrollTextMachine } from '../machines/scrollTextMachine.ts';
import { SCROLL_TEXT_OFFSET_X, SCROLL_TEXT_EXIT_Z_OFFSET } from '../machines/scrollTextMachine.ts';
import type { cameraKeyframeMachine } from '../machines/cameraKeyframeMachine.ts';
import type { scrollCardMachine } from '../machines/scrollCardMachine.ts';
import type { EasingType } from '../utils/easing.ts';
import { EASING_OPTIONS } from '../utils/easing.ts';
import { NEON_PRESET_NAMES } from '../machines/neonBandsMachine.ts';
import { SITUATIONS } from '../data/defaultPresets.ts';
import type { Situation } from '../data/defaultPresets.ts';
import { LIGHT_POSITION_PRESETS } from '../utils/lightPresets.ts';
import { PBR_PRESETS } from '../utils/pbrPresets.ts';
import { TONE_MAPPING_OPTIONS } from '../utils/toneMappingMap.ts';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ContentProps {
  bloomActor: ActorRefFrom<typeof bloomMachine>;
  lightingActor: ActorRefFrom<typeof lightingMachine>;
  pbrActor: ActorRefFrom<typeof pbrMachine>;
  materialActor: ActorRefFrom<typeof materialMachine>;
  sceneActor: ActorRefFrom<typeof sceneMachine>;
  performanceActor: ActorRefFrom<typeof performanceMonitor>;
  revelationActor: ActorRefFrom<typeof revelationMachine>;
  modelActor: ActorRefFrom<typeof modelMachine>;
  visualPresetActor: ActorRefFrom<typeof visualPresetMachine>;
  neonBandsActor: ActorRefFrom<typeof neonBandsMachine>;
  steeringActor: ActorRefFrom<typeof steeringMachine>;
  scrollTextActor: ActorRefFrom<typeof scrollTextMachine>;
  cameraKeyframeActor: ActorRefFrom<typeof cameraKeyframeMachine>;
  scrollCardActor: ActorRefFrom<typeof scrollCardMachine>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  panel: {
    position: 'fixed' as const,
    top: '20px',
    left: '20px',
    width: '300px',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    overscrollBehavior: 'contain' as const,
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#ddd',
    fontFamily: '"Courier New", monospace',
    fontSize: '11px',
    zIndex: 9999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    userSelect: 'none' as const,
    pointerEvents: 'auto' as const,
  },
  header: {
    background: '#0d0d0d',
    padding: '7px 10px',
    borderBottom: '1px solid #2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: '10px',
    color: '#555',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
  },
  tabNav: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '2px',
    padding: '5px',
    background: '#111',
    borderBottom: '1px solid #222',
  },
  section: {
    padding: '9px 10px',
    borderBottom: '1px solid #1c1c1c',
  },
  h3: {
    margin: '0 0 7px 0',
    fontSize: '9px',
    color: '#777',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  row: { marginBottom: '7px' },
  label: {
    display: 'block' as const,
    color: '#aaa',
    fontSize: '11px',
    marginBottom: '2px',
  },
  checkLabel: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: '6px',
    color: '#aaa',
    fontSize: '11px',
    cursor: 'pointer',
  },
  range: {
    width: '100%',
    margin: '3px 0',
    accentColor: '#3b82f6',
  },
  select: {
    width: '100%',
    background: '#222',
    color: '#ddd',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    padding: '3px 5px',
    fontSize: '11px',
  },
  btnSm: {
    background: '#1e1e1e',
    color: '#bbb',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: '3px 7px',
    fontSize: '10px',
  },
  btnPrimary: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: '11px',
    width: '100%',
    marginBottom: '4px',
  },
  btnDanger: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: '11px',
    width: '100%',
  },
  btnReset: {
    background: 'transparent',
    color: '#555',
    border: '1px solid #2a2a2a',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: '3px 8px',
    fontSize: '10px',
    marginTop: '4px',
  },
  colorInput: {
    width: '34px',
    height: '20px',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: 0,
    verticalAlign: 'middle',
    marginLeft: '6px',
  },
  presetGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '3px',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px',
    marginBottom: '5px',
    fontSize: '10px',
  },
  statLabel: { color: '#555' },
  statVal: { color: '#4ade80', textAlign: 'right' as const },
  progressWrap: {
    height: '4px',
    background: '#2a2a2a',
    borderRadius: '2px',
    overflow: 'hidden' as const,
    margin: '3px 0',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10px' },
  th: { textAlign: 'left' as const, padding: '3px 4px', borderBottom: '1px solid #2a2a2a', color: '#555' },
  td: { padding: '2px 4px', borderBottom: '1px solid #1a1a1a', color: '#999' },
  flexRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '3px', marginTop: '3px' },
  infoBox: {
    background: '#0d0d0d',
    borderRadius: '3px',
    padding: '5px 7px',
    fontSize: '10px',
    color: '#444',
    lineHeight: 1.5,
    marginTop: '4px',
  },
};

const tabBtnSt = (active: boolean) => ({
  ...s.btnSm,
  background: active ? '#3b82f6' : '#181818',
  color: active ? '#fff' : '#555',
  border: `1px solid ${active ? '#3b82f6' : '#2a2a2a'}`,
  padding: '2px 7px',
  fontSize: '10px',
});

const presetBtnSt = (active: boolean) => ({
  ...s.btnSm,
  background: active ? '#3b82f6' : '#202020',
  color: active ? '#fff' : '#888',
  border: `1px solid ${active ? '#3b82f6' : '#3a3a3a'}`,
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials', 'Scene', 'Perf', 'Reveal', 'Model', 'Steering', 'ScrollText', 'CamPath', 'Card'] as const;
type TabId = typeof TABS[number];

const SITUATION_LABELS: Record<Situation, string> = {
  idle_disconnected: 'Idle (disconnected)',
  idle_connected: 'Idle (connected)',
  error: 'Error',
  alphabet_search: 'Alphabet Search',
  buy_success: 'Buy Success',
  afk: 'AFK',
};

// ─── Composant interne ────────────────────────────────────────────────────────

function DevControlPanelContent({
  bloomActor, lightingActor, pbrActor, materialActor,
  sceneActor, performanceActor, revelationActor, modelActor,
  visualPresetActor, neonBandsActor, steeringActor, scrollTextActor,
  cameraKeyframeActor, scrollCardActor,
}: ContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Presets');
  const [htmlHidden, setHtmlHidden] = useState(false);

  // ── Drag panel ──────────────────────────────────────────────────────────────
  const [dragPos, setDragPos] = useState({ x: Math.max(0, window.innerWidth - 320), y: 20 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      setDragPos({
        x: Math.max(0, e.clientX - dragOffsetRef.current.x),
        y: Math.max(0, e.clientY - dragOffsetRef.current.y),
      });
    }
    function onMouseUp() { isDraggingRef.current = false; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function onHeaderMouseDown(e: React.MouseEvent) {
    isDraggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y };
  }

  const bloom = useBloom(bloomActor);
  const lighting = useLighting(lightingActor);
  const pbr = usePBR(pbrActor);
  const material = useMaterial(materialActor);
  const scene = useScene(sceneActor);
  const perf = usePerformance(performanceActor);
  const revelation = useRevelation(revelationActor);
  const model = useModel(modelActor);
  const vPreset = useVisualPreset(visualPresetActor);
  const neon = useNeonBands(neonBandsActor);
  const steering = useSteering(steeringActor);
  const scrollText = useScrollText(scrollTextActor);
  const camKf = useCameraKeyframes(cameraKeyframeActor);
  const card = useScrollCard(scrollCardActor);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const camKfFileInputRef = useRef<HTMLInputElement>(null);
  const scrollTextFileInputRef = useRef<HTMLInputElement>(null);

  const panelStyle = { ...s.panel, top: dragPos.y, left: dragPos.x };

  return (
    <div style={panelStyle}>

      {/* ── Header — drag handle ── */}
      <div
        style={{ ...s.header, cursor: 'move', userSelect: 'none' }}
        onMouseDown={onHeaderMouseDown}
      >
        <h2 style={s.title}>Overmind Dev</h2>
        <div style={{ display: 'flex', gap: '3px' }}>
          <button
            style={{ ...s.btnSm, background: htmlHidden ? '#ef4444' : '#1e1e1e', color: htmlHidden ? '#fff' : '#bbb' }}
            onClick={() => {
              const next = !htmlHidden;
              setHtmlHidden(next);
              document.body.classList.toggle('hide-html-content', next);
            }}
            title="Hide/Show HTML content">
            {htmlHidden ? 'HTML Off' : 'HTML'}
          </button>
          <button style={s.btnSm} onClick={revelation.startRingAnimation} title="Trigger Ring Animation">Ring</button>
          <button style={s.btnSm} onClick={revelation.toggleForceShowAll} title="Toggle Reveal Rings">Reveal</button>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div style={s.tabNav}>
        {TABS.map((t) => (
          <button key={t} style={tabBtnSt(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div>

        {/* ── PRESETS ── */}
        {activeTab === 'Presets' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Situation actuelle</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: vPreset.isTransitioning ? '#f59e0b' : '#22c55e',
                }} />
                <span style={{ color: '#ccc', fontSize: '11px' }}>
                  {SITUATION_LABELS[vPreset.situation]}
                </span>
              </div>
              {vPreset.isTransitioning && (
                <div style={s.progressWrap}>
                  <div style={{
                    height: '100%',
                    width: `${(vPreset.transitionProgress * 100).toFixed(0)}%`,
                    background: '#3b82f6',
                    borderRadius: '2px',
                    transition: 'width 50ms linear',
                  }} />
                </div>
              )}
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Changer de situation</h3>
              <select style={s.select}
                value={vPreset.situation}
                onChange={(e) => vPreset.setSituation(e.target.value as Situation)}>
                {SITUATIONS.map((sit) => (
                  <option key={sit} value={sit}>{SITUATION_LABELS[sit]}</option>
                ))}
              </select>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Preset actuel</h3>
              <button style={s.btnPrimary}
                onClick={() => {
                  const captured = {
                    bloom: {
                      color: bloom.bloomColor,
                      strength: bloom.strength,
                      threshold: bloom.threshold,
                      radius: bloom.radius,
                    },
                    lighting: {
                      ambientIntensity: lighting.ambientIntensity,
                      directionalIntensity: lighting.directionalIntensity,
                      pointIntensity: lighting.pointIntensity,
                      exposure: lighting.exposure,
                      hdrBoostMultiplier: lighting.hdrBoostMultiplier,
                    },
                    material: {
                      iris: { emissiveColor: material.iris.emissiveColor, emissiveIntensity: material.iris.emissiveIntensity },
                      eyeRings: { emissiveColor: material.eyeRings.emissiveColor, emissiveIntensity: material.eyeRings.emissiveIntensity },
                      revealRings: { emissiveColor: material.revealRings.emissiveColor, emissiveIntensity: material.revealRings.emissiveIntensity },
                    },
                    pbr: {
                      eyeRings: { metalness: pbr.eyeRings.metalness, roughness: pbr.eyeRings.roughness },
                      iris: { metalness: pbr.iris.metalness, roughness: pbr.iris.roughness },
                      magicRings: { metalness: pbr.magicRings.metalness, roughness: pbr.magicRings.roughness },
                      arms: { metalness: pbr.arms.metalness, roughness: pbr.arms.roughness },
                    },
                  };
                  vPreset.saveCurrentAsPreset(vPreset.situation, captured);
                }}>
                Sauvegarder les valeurs actuelles
              </button>
              <div style={s.infoBox}>
                Capture les reglages bloom/lighting/material/pbr actuels
                et les enregistre comme preset pour &laquo; {SITUATION_LABELS[vPreset.situation]} &raquo;
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Import / Export JSON</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button style={{ ...s.btnSm, flex: 1 }} onClick={vPreset.exportPresets}>Export</button>
                <button style={{ ...s.btnSm, flex: 1 }} onClick={() => fileInputRef.current?.click()}>Import</button>
                <input ref={fileInputRef} type="file" accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) vPreset.importPresets(file);
                    e.target.value = '';
                  }} />
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={vPreset.restoreDefaults}>Reset defaults</button>
            </div>
          </div>
        )}

        {/* ── BLOOM ── */}
        {activeTab === 'Bloom' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Global Bloom</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={bloom.enabled} onChange={bloom.toggleBloom} />
                  Enable Bloom
                </label>
              </div>
              <div style={s.row}>
                <label style={s.label}>Threshold: {bloom.threshold.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="1" step="0.01"
                  value={bloom.threshold} disabled={!bloom.enabled}
                  onChange={(e) => bloom.updateThreshold(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Strength: {bloom.strength.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="3" step="0.1"
                  value={bloom.strength} disabled={!bloom.enabled}
                  onChange={(e) => bloom.updateStrength(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Radius: {bloom.radius.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="1" step="0.01"
                  value={bloom.radius} disabled={!bloom.enabled}
                  onChange={(e) => bloom.updateRadius(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>
                  Color:
                  <input style={s.colorInput} type="color"
                    value={bloom.bloomColor} disabled={!bloom.enabled}
                    onChange={(e) => bloom.setBloomColor(e.target.value)} />
                  <span style={{ marginLeft: '6px', color: '#555', fontSize: '10px' }}>{bloom.bloomColor}</span>
                </label>
              </div>
              <button style={s.btnReset} onClick={bloom.restoreDefaults}>Reset</button>
            </div>
          </div>
        )}

        {/* ── NEON BANDS ── */}
        {activeTab === 'Neon' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Presets</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {NEON_PRESET_NAMES.map((name) => (
                  <button key={name}
                    style={{ ...s.btnReset, fontSize: '10px', padding: '3px 8px' }}
                    onClick={() => neon.applyPreset(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Global Width</h3>
              <div style={s.row}>
                <label style={s.label}>All Bands: {neon.bands[0]?.width.toFixed(2) ?? '0.60'}</label>
                <input style={s.range} type="range" min="0.1" max="3" step="0.05"
                  value={neon.bands[0]?.width ?? 0.6}
                  onChange={(e) => neon.setAllWidths(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Cascade Flow</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={neon.flowEnabled} onChange={neon.toggleFlow} />
                  Enable Flow Animation
                </label>
              </div>
              <div style={s.row}>
                <label style={s.label}>Flow Speed: {neon.flowSpeed.toFixed(1)}</label>
                <input style={s.range} type="range" min="0" max="5" step="0.1"
                  value={neon.flowSpeed}
                  onChange={(e) => neon.updateFlowSpeed(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Global Intensity: {neon.globalIntensity.toFixed(1)}</label>
                <input style={s.range} type="range" min="0" max="3" step="0.1"
                  value={neon.globalIntensity}
                  onChange={(e) => neon.updateGlobalIntensity(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Position & Scale</h3>
              <div style={s.row}>
                <label style={s.label}>X: {neon.positionX.toFixed(1)}</label>
                <input style={s.range} type="range" min="-15" max="15" step="0.5"
                  value={neon.positionX}
                  onChange={(e) => neon.updatePositionX(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Y: {neon.positionY.toFixed(1)}</label>
                <input style={s.range} type="range" min="-10" max="10" step="0.5"
                  value={neon.positionY}
                  onChange={(e) => neon.updatePositionY(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Z (profondeur): {neon.positionZ.toFixed(1)}</label>
                <input style={s.range} type="range" min="-20" max="0" step="0.5"
                  value={neon.positionZ}
                  onChange={(e) => neon.updatePositionZ(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Scale: {neon.scale.toFixed(2)}</label>
                <input style={s.range} type="range" min="0.1" max="3" step="0.05"
                  value={neon.scale}
                  onChange={(e) => neon.updateScale(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Layout</h3>
              <div style={s.row}>
                <label style={s.label}>Band Spacing: {neon.bandSpacing.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="1" step="0.05"
                  value={neon.bandSpacing}
                  onChange={(e) => neon.updateBandSpacing(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Arc Radius: {neon.arcRadius.toFixed(1)}</label>
                <input style={s.range} type="range" min="2" max="10" step="0.5"
                  value={neon.arcRadius}
                  onChange={(e) => neon.updateArcRadius(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Depth Spread: {neon.depthSpread.toFixed(1)}x</label>
                <input style={s.range} type="range" min="1" max="8" step="0.1"
                  value={neon.depthSpread}
                  onChange={(e) => neon.updateDepthSpread(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Line Length: {neon.lineLength.toFixed(0)}</label>
                <input style={s.range} type="range" min="5" max="30" step="1"
                  value={neon.lineLength}
                  onChange={(e) => neon.updateLineLength(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Bands ({neon.bands.length})</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {neon.bands.map((band, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 0', borderBottom: '1px solid #1a1a1a',
                  }}>
                    <input type="checkbox" checked={band.visible}
                      onChange={() => neon.toggleBandVisible(i)} />
                    <input style={s.colorInput} type="color" value={band.color}
                      onChange={(e) => neon.updateBandColor(i, e.target.value)} />
                    <span style={{ color: '#888', fontSize: '10px', minWidth: '18px' }}>{i}</span>
                    <input style={{ ...s.range, flex: 1 }} type="range" min="0.1" max="3" step="0.05"
                      value={band.width} title="Width"
                      onChange={(e) => neon.updateBandWidth(i, +e.target.value)} />
                    <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.width.toFixed(1)}</span>
                    <input style={{ ...s.range, flex: 1 }} type="range" min="0" max="5" step="0.1"
                      value={band.intensity} title="Intensity"
                      onChange={(e) => neon.updateBandIntensity(i, +e.target.value)} />
                    <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.intensity.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={neon.restoreDefaults}>Reset All</button>
            </div>
          </div>
        )}

        {/* ── LIGHTING ── */}
        {activeTab === 'Lighting' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Intensities</h3>
              <div style={s.row}>
                <label style={s.label}>Ambient: {lighting.ambientIntensity.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="2" step="0.1"
                  value={lighting.ambientIntensity}
                  onChange={(e) => lighting.updateAmbientIntensity(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Directional: {lighting.directionalIntensity.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="5" step="0.1"
                  value={lighting.directionalIntensity}
                  onChange={(e) => lighting.updateDirectionalIntensity(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Point: {lighting.pointIntensity.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="5" step="0.1"
                  value={lighting.pointIntensity}
                  onChange={(e) => lighting.updatePointIntensity(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Exposure & HDR</h3>
              <div style={s.row}>
                <label style={s.label}>Exposure: {lighting.exposure.toFixed(2)}</label>
                <input style={s.range} type="range" min="0.5" max="3" step="0.1"
                  value={lighting.exposure}
                  onChange={(e) => lighting.updateExposure(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={lighting.hdrBoostEnabled} onChange={lighting.toggleHDRBoost} />
                  HDR Boost
                </label>
              </div>
              {lighting.hdrBoostEnabled && (
                <div style={s.row}>
                  <label style={s.label}>HDR Multiplier: {lighting.hdrBoostMultiplier.toFixed(1)}</label>
                  <input style={s.range} type="range" min="1" max="5" step="0.5"
                    value={lighting.hdrBoostMultiplier}
                    onChange={(e) => lighting.updateHDRMultiplier(+e.target.value)} />
                </div>
              )}
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Position Presets</h3>
              <div style={s.presetGrid}>
                {Object.entries(LIGHT_POSITION_PRESETS).map(([key, preset]) => (
                  <button key={key}
                    style={presetBtnSt(lighting.currentPreset === key)}
                    onClick={() => lighting.applyLightPreset(key)}
                    title={preset.description}>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Directional Position</h3>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} style={s.row}>
                  <label style={s.label}>
                    {axis.toUpperCase()}: {lighting.directionalPosition[axis].toFixed(1)}
                  </label>
                  <input style={s.range} type="range" min="-10" max="10" step="0.5"
                    value={lighting.directionalPosition[axis]}
                    onChange={(e) => lighting.updateDirectionalPosition({
                      ...lighting.directionalPosition, [axis]: +e.target.value
                    })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PBR ── */}
        {activeTab === 'PBR' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Tone Mapping</h3>
              <select style={s.select} value={pbr.toneMapping}
                onChange={(e) => pbr.setToneMapping(e.target.value as Parameters<typeof pbr.setToneMapping>[0])}>
                {TONE_MAPPING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {([
              { id: 'eyeRings' as const, label: 'Eye Rings' },
              { id: 'iris' as const, label: 'Iris' },
              { id: 'magicRings' as const, label: 'Magic Rings' },
              { id: 'arms' as const, label: 'Arms' },
            ]).map((group) => (
              <div key={group.id} style={s.section}>
                <h3 style={s.h3}>{group.label}</h3>
                <div style={s.row}>
                  <label style={s.label}>Metalness: {pbr[group.id].metalness.toFixed(2)}</label>
                  <input style={s.range} type="range" min="0" max="1" step="0.05"
                    value={pbr[group.id].metalness}
                    onChange={(e) => pbr.updateGroupMetalness(group.id, +e.target.value)} />
                </div>
                <div style={s.row}>
                  <label style={s.label}>Roughness: {pbr[group.id].roughness.toFixed(2)}</label>
                  <input style={s.range} type="range" min="0" max="1" step="0.05"
                    value={pbr[group.id].roughness}
                    onChange={(e) => pbr.updateGroupRoughness(group.id, +e.target.value)} />
                </div>
                <div style={s.presetGrid}>
                  {Object.entries(PBR_PRESETS).map(([key, preset]) => (
                    <button key={key} style={s.btnSm}
                      onClick={() => pbr.applyPresetToGroup(group.id, key)}
                      title={preset.description}>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={s.section}>
              <button style={s.btnReset} onClick={pbr.restoreDefaults}>Reset All</button>
            </div>
          </div>
        )}

        {/* ── MATERIALS ── */}
        {activeTab === 'Materials' && (
          <div>
            <div style={{ ...s.section, paddingBottom: '5px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: '#444' }}>
                Couleur et intensite d'emission (glow) par groupe
              </p>
            </div>
            {([
              { name: 'iris' as const, label: 'Iris' },
              { name: 'eyeRings' as const, label: 'Eye Rings' },
              { name: 'revealRings' as const, label: 'Reveal Rings' },
            ]).map(({ name, label }) => {
              const grp = material[name];
              return (
                <div key={name} style={s.section}>
                  <h3 style={s.h3}>{label}</h3>
                  <div style={s.row}>
                    <label style={s.label}>
                      Emissive:
                      <input style={s.colorInput} type="color"
                        value={grp.emissiveColor}
                        onChange={(e) => material.updateGroupEmissiveColor(name, e.target.value)} />
                      <span style={{ marginLeft: '6px', color: '#444', fontSize: '10px' }}>{grp.emissiveColor}</span>
                    </label>
                  </div>
                  <div style={s.row}>
                    <label style={s.label}>Intensity: {grp.emissiveIntensity.toFixed(2)}</label>
                    <input style={s.range} type="range" min="0" max="5" step="0.1"
                      value={grp.emissiveIntensity}
                      onChange={(e) => material.updateGroupEmissiveIntensity(name, +e.target.value)} />
                  </div>
                </div>
              );
            })}
            <div style={{ ...s.section, ...s.infoBox }}>
              <strong>emissive</strong> = neon &middot; <strong>intensity</strong> = 0 eteint / 5 brillant
            </div>
          </div>
        )}

        {/* ── SCENE ── */}
        {activeTab === 'Scene' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Background</h3>
              <label style={s.label}>
                Color:
                <input style={s.colorInput} type="color"
                  value={scene.backgroundColor}
                  onChange={(e) => scene.setBackgroundColor(e.target.value)} />
                <span style={{ marginLeft: '6px', color: '#444', fontSize: '10px' }}>{scene.backgroundColor}</span>
              </label>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Grid Helper</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={scene.gridVisible} onChange={scene.toggleGrid} />
                  Show Grid
                </label>
              </div>
              <div style={s.row}>
                <label style={s.label}>Size: {scene.gridSize}</label>
                <input style={s.range} type="range" min="5" max="50" step="5"
                  value={scene.gridSize} disabled={!scene.gridVisible}
                  onChange={(e) => scene.updateGridSize(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Divisions: {scene.gridDivisions}</label>
                <input style={s.range} type="range" min="5" max="50" step="5"
                  value={scene.gridDivisions} disabled={!scene.gridVisible}
                  onChange={(e) => scene.updateGridDivisions(+e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={s.label}>
                  Center:
                  <input style={s.colorInput} type="color"
                    value={scene.gridColor1} disabled={!scene.gridVisible}
                    onChange={(e) => scene.updateGridColors(e.target.value, scene.gridColor2)} />
                </label>
                <label style={s.label}>
                  Grid:
                  <input style={s.colorInput} type="color"
                    value={scene.gridColor2} disabled={!scene.gridVisible}
                    onChange={(e) => scene.updateGridColors(scene.gridColor1, e.target.value)} />
                </label>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Axes Helper</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={scene.axesVisible} onChange={scene.toggleAxes} />
                  Show Axes (RGB = XYZ)
                </label>
              </div>
              <div style={s.row}>
                <label style={s.label}>Size: {scene.axesSize}</label>
                <input style={s.range} type="range" min="1" max="20" step="1"
                  value={scene.axesSize} disabled={!scene.axesVisible}
                  onChange={(e) => scene.updateAxesSize(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Camera</h3>
              <div style={s.row}>
                <label style={s.label}>Position X: {scene.cameraX.toFixed(1)}</label>
                <input style={s.range} type="range" min="-20" max="20" step="0.5"
                  value={scene.cameraX}
                  onChange={(e) => scene.updateCameraPosition(+e.target.value, scene.cameraY, scene.cameraZ)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Position Y: {scene.cameraY.toFixed(1)}</label>
                <input style={s.range} type="range" min="-10" max="20" step="0.5"
                  value={scene.cameraY}
                  onChange={(e) => scene.updateCameraPosition(scene.cameraX, +e.target.value, scene.cameraZ)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Position Z: {scene.cameraZ.toFixed(1)}</label>
                <input style={s.range} type="range" min="1" max="50" step="0.5"
                  value={scene.cameraZ}
                  onChange={(e) => scene.updateCameraPosition(scene.cameraX, scene.cameraY, +e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Look At X: {scene.lookAtX.toFixed(1)}</label>
                <input style={s.range} type="range" min="-10" max="10" step="0.5"
                  value={scene.lookAtX}
                  onChange={(e) => scene.updateLookAt(+e.target.value, scene.lookAtY, scene.lookAtZ)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Look At Y: {scene.lookAtY.toFixed(1)}</label>
                <input style={s.range} type="range" min="-5" max="10" step="0.5"
                  value={scene.lookAtY}
                  onChange={(e) => scene.updateLookAt(scene.lookAtX, +e.target.value, scene.lookAtZ)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Look At Z: {scene.lookAtZ.toFixed(1)}</label>
                <input style={s.range} type="range" min="-10" max="10" step="0.5"
                  value={scene.lookAtZ}
                  onChange={(e) => scene.updateLookAt(scene.lookAtX, scene.lookAtY, +e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>FOV: {scene.fov.toFixed(0)}&deg;</label>
                <input style={s.range} type="range" min="10" max="120" step="1"
                  value={scene.fov}
                  onChange={(e) => scene.updateFov(+e.target.value)} />
              </div>
              <div style={s.infoBox}>
                <strong>Position Z</strong> = distance de la cam&eacute;ra (d&eacute;faut 12) &middot;
                <strong>FOV</strong> = champ de vision (d&eacute;faut 45&deg;)
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={scene.restoreDefaults}>Reset</button>
            </div>
          </div>
        )}

        {/* ── PERFORMANCE ── */}
        {activeTab === 'Perf' && (
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
        )}

        {/* ── REVELATION ── */}
        {activeTab === 'Reveal' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Systeme de Revelation</h3>
              <button style={s.btnPrimary}
                onClick={revelation.startRingAnimation}
                disabled={revelation.isAnimating}>
                {revelation.isAnimating ? 'En cours...' : 'Lancer Ring Animation'}
              </button>
              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#555' }}>
                Anneaux visibles: {revelation.ringInfos.filter((r: { visible: boolean }) => r.visible).length}/{revelation.ringInfos.length}
              </p>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Zone Trigger</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={revelation.showZoneHelper}
                    onChange={(e) => revelation.toggleZoneHelper(e.target.checked)} />
                  Afficher zone dans la scene
                </label>
              </div>
              <div style={s.row}>
                <label style={{ ...s.label, marginBottom: '3px' }}>
                  Pos: X={revelation.triggerZone.position.x.toFixed(2)}{' '}
                  Y={revelation.triggerZone.position.y.toFixed(2)}{' '}
                  Z={revelation.triggerZone.position.z.toFixed(2)}
                </label>
                <div style={s.flexRow}>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('forward')}>Z+</button>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('backward')}>Z-</button>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('left')}>X-</button>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('right')}>X+</button>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('up')}>Y+</button>
                  <button style={s.btnSm} onClick={() => revelation.moveZone('down')}>Y-</button>
                </div>
              </div>
              <div style={s.row}>
                <label style={s.label}>Rayon: {revelation.triggerZone.radius.toFixed(2)}</label>
                <div style={s.flexRow}>
                  <button style={s.btnSm} onClick={() => revelation.scaleZone('increase')}>R+</button>
                  <button style={s.btnSm} onClick={() => revelation.scaleZone('decrease')}>R-</button>
                </div>
              </div>
              <button style={s.btnReset} onClick={revelation.resetZone}>Reset Zone</button>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Anneaux ({revelation.ringInfos.length})</h3>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {revelation.ringInfos.length === 0 ? (
                  <p style={{ margin: 0, color: '#444', fontSize: '10px' }}>Aucun anneau enregistre</p>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Nom</th>
                        <th style={{ ...s.th, textAlign: 'center' }}>Vis.</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Dist.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revelation.ringInfos.map((ring: { name: string; visible: boolean; distance: number }, i: number) => (
                        <tr key={i}>
                          <td style={s.td}>{ring.name}</td>
                          <td style={{ ...s.td, textAlign: 'center' }}>{ring.visible ? 'O' : '.'}</td>
                          <td style={{ ...s.td, textAlign: 'right' }}>{ring.distance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div style={{ ...s.section, ...s.infoBox }}>
              <strong>Controls</strong> : Z+/Z- axe Z &middot; X+/X- axe X &middot; Y+/Y- axe Y &middot; R+/R- rayon
            </div>
          </div>
        )}

        {/* ── STEERING ── */}
        {activeTab === 'Steering' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Vehicle</h3>
              <div style={s.row}>
                <label style={s.label}>Max Speed: {steering.maxSpeed.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.1" max="5" step="0.1"
                  value={steering.maxSpeed}
                  onChange={(e) => steering.setMaxSpeed(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Max Force: {steering.maxForce.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.maxForce}
                  onChange={(e) => steering.setMaxForce(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Mass: {steering.mass.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="15" step="0.5"
                  value={steering.mass}
                  onChange={(e) => steering.setMass(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Wander</h3>
              <div style={s.row}>
                <label style={s.label}>Radius: {steering.wanderRadius.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.1" max="5" step="0.1"
                  value={steering.wanderRadius}
                  onChange={(e) => steering.setWanderRadius(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Distance: {steering.wanderDistance.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="8" step="0.5"
                  value={steering.wanderDistance}
                  onChange={(e) => steering.setWanderDistance(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Jitter: {steering.wanderJitter.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.1" max="10" step="0.1"
                  value={steering.wanderJitter}
                  onChange={(e) => steering.setWanderJitter(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Z Factor: {steering.wanderZFactor.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="1.5" step="0.05"
                  value={steering.wanderZFactor}
                  onChange={(e) => steering.setWanderZFactor(+e.target.value)} />
              </div>
              <div style={s.infoBox}>
                <strong>Radius</strong> = largeur des virages &middot;
                <strong>Distance</strong> = longueur entre virages &middot;
                <strong>Jitter</strong> = nervosit&eacute; des changements &middot;
                <strong>Z Factor</strong> = intensit&eacute; du mouvement en profondeur (0 = aucun)
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Boundaries (Zone)</h3>
              <div style={s.row}>
                <label style={s.label}>X Range: &plusmn;{steering.boundaryXRange.toFixed(0)}</label>
                <input style={s.range} type="range" min="2" max="20" step="1"
                  value={steering.boundaryXRange}
                  onChange={(e) => steering.setBoundaryXRange(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Y Down: {steering.boundaryYDown.toFixed(1)}</label>
                <input style={s.range} type="range" min="1" max="10" step="0.5"
                  value={steering.boundaryYDown}
                  onChange={(e) => steering.setBoundaryYDown(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Y Up: {steering.boundaryYUp.toFixed(1)}</label>
                <input style={s.range} type="range" min="1" max="10" step="0.5"
                  value={steering.boundaryYUp}
                  onChange={(e) => steering.setBoundaryYUp(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Z Profondeur (loin): {steering.boundaryZBack.toFixed(1)}</label>
                <input style={s.range} type="range" min="0" max="12" step="0.5"
                  value={steering.boundaryZBack}
                  onChange={(e) => steering.setBoundaryZBack(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Z Proche (cam&eacute;ra): {steering.boundaryZFront.toFixed(1)}</label>
                <input style={s.range} type="range" min="0" max="5" step="0.5"
                  value={steering.boundaryZFront}
                  onChange={(e) => steering.setBoundaryZFront(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Margin: {steering.boundaryMargin.toFixed(1)}</label>
                <input style={s.range} type="range" min="1" max="15" step="0.5"
                  value={steering.boundaryMargin}
                  onChange={(e) => steering.setBoundaryMargin(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Strength: {steering.boundaryStrength.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.boundaryStrength}
                  onChange={(e) => steering.setBoundaryStrength(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Weight: {steering.boundaryWeight.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.boundaryWeight}
                  onChange={(e) => steering.setBoundaryWeight(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Wall Bounce: {steering.wallBounceFactor.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="0.5" step="0.01"
                  value={steering.wallBounceFactor}
                  onChange={(e) => steering.setWallBounceFactor(+e.target.value)} />
              </div>
              <div style={s.infoBox}>
                <strong>Margin</strong> = distance avant rebond doux &middot;
                <strong>Bounce</strong> = 0 = absorbe, 0.5 = rebond
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Mouse Repulsion</h3>
              <div style={s.row}>
                <label style={s.label}>Base Min Dist: {steering.repulsionBaseMinDist.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.repulsionBaseMinDist}
                  onChange={(e) => steering.setRepulsionBaseMinDist(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Amplitude: {steering.repulsionAmplitude.toFixed(1)}</label>
                <input style={s.range} type="range" min="0" max="5" step="0.1"
                  value={steering.repulsionAmplitude}
                  onChange={(e) => steering.setRepulsionAmplitude(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Speed: {steering.repulsionSpeed.toFixed(2)}</label>
                <input style={s.range} type="range" min="0.05" max="2" step="0.05"
                  value={steering.repulsionSpeed}
                  onChange={(e) => steering.setRepulsionSpeed(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Strength: {steering.repulsionStrength.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.repulsionStrength}
                  onChange={(e) => steering.setRepulsionStrength(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Weight: {steering.repulsionWeight.toFixed(1)}</label>
                <input style={s.range} type="range" min="0.5" max="10" step="0.5"
                  value={steering.repulsionWeight}
                  onChange={(e) => steering.setRepulsionWeight(+e.target.value)} />
              </div>
              <div style={s.infoBox}>
                Distance min pulse : base &plusmn; amplitude &middot;
                <strong>Speed</strong> = vitesse de pulsation
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={steering.reset}>Reset Steering</button>
            </div>
          </div>
        )}

        {/* ── MODEL ── */}
        {activeTab === 'Model' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Position</h3>
              {(['positionX', 'positionY', 'positionZ'] as const).map((key) => (
                <div key={key} style={s.row}>
                  <label style={s.label}>{key.replace('position', '')}: {model[key].toFixed(2)}</label>
                  <input style={s.range} type="range" min="-10" max="10" step="0.1"
                    value={model[key]}
                    onChange={(e) => model.setPosition(
                      key === 'positionX' ? +e.target.value : model.positionX,
                      key === 'positionY' ? +e.target.value : model.positionY,
                      key === 'positionZ' ? +e.target.value : model.positionZ,
                    )} />
                </div>
              ))}
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Scale & Base Rotation</h3>
              <div style={s.row}>
                <label style={s.label}>Scale: {model.scale.toFixed(2)}</label>
                <input style={s.range} type="range" min="0.1" max="5" step="0.05"
                  value={model.scale}
                  onChange={(e) => model.setScale(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Base Rot Y: {(model.baseRotationY * 180 / Math.PI).toFixed(1)}&deg;</label>
                <input style={s.range} type="range" min="-180" max="180" step="1"
                  value={model.baseRotationY * 180 / Math.PI}
                  onChange={(e) => model.setBaseRotationY(+e.target.value * Math.PI / 180)} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Mouse Tracking</h3>
              <div style={s.row}>
                <label style={s.label}>Sensitivity: {model.mouseSensitivity.toFixed(3)}</label>
                <input style={s.range} type="range" min="0.001" max="0.2" step="0.001"
                  value={model.mouseSensitivity}
                  onChange={(e) => model.setMouseSensitivity(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Return Speed: {model.mouseReturnSpeed.toFixed(3)}</label>
                <input style={s.range} type="range" min="0.001" max="0.2" step="0.001"
                  value={model.mouseReturnSpeed}
                  onChange={(e) => model.setMouseReturnSpeed(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Dead Zone: {model.mouseDeadZone.toFixed(2)}</label>
                <input style={s.range} type="range" min="0" max="0.5" step="0.01"
                  value={model.mouseDeadZone}
                  onChange={(e) => model.setMouseDeadZone(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Max Rot Y: {(model.mouseMaxRotY * 180 / Math.PI).toFixed(0)}&deg;</label>
                <input style={s.range} type="range" min="5" max="180" step="1"
                  value={model.mouseMaxRotY * 180 / Math.PI}
                  onChange={(e) => model.setMouseMaxRotY(+e.target.value * Math.PI / 180)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Max Rot X: {(model.mouseMaxRotX * 180 / Math.PI).toFixed(0)}&deg;</label>
                <input style={s.range} type="range" min="5" max="90" step="1"
                  value={model.mouseMaxRotX * 180 / Math.PI}
                  onChange={(e) => model.setMouseMaxRotX(+e.target.value * Math.PI / 180)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Inactive: {model.mouseInactiveMs}ms</label>
                <input style={s.range} type="range" min="500" max="10000" step="500"
                  value={model.mouseInactiveMs}
                  onChange={(e) => model.setMouseInactiveMs(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={model.reset}>Reset Model</button>
            </div>
          </div>
        )}

        {/* ── CAM PATH ── */}
        {activeTab === 'CamPath' && (
          <div>
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
              <h3 style={s.h3}>Add Keyframe</h3>
              <button style={s.btnPrimary} onClick={() => {
                camKf.addKeyframe({
                  at: camKf.scrollProgress,
                  posX: scene.cameraX,
                  posY: scene.cameraY,
                  posZ: scene.cameraZ,
                  lookAtX: scene.lookAtX,
                  lookAtY: scene.lookAtY,
                  lookAtZ: scene.lookAtZ,
                  fov: scene.fov,
                  easing: 'smoothstep',
                });
              }}>
                Add Keyframe at scroll={camKf.scrollProgress.toFixed(3)}
              </button>
              <div style={s.infoBox}>
                Capture la position camera actuelle (onglet Scene) au scroll courant.
                D&eacute;sactiver le keyframe control pour positionner librement la cam&eacute;ra.
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
        )}

        {/* ── SCROLL TEXT ── */}
        {activeTab === 'ScrollText' && (
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
        )}

        {/* ── CARD ── */}
        {activeTab === 'Card' && (
          <div>
            <div style={s.section}>
              <h3 style={s.h3}>Card Visibility</h3>
              <div style={s.row}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={card.enabled} onChange={(e) => card.setEnabled(e.target.checked)} />
                  Enable Card
                </label>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.h3}>Card Position</h3>
              <div style={s.row}>
                <label style={s.label}>Top: {card.posTop.toFixed(1)}%</label>
                <input style={s.range} type="range" min={0} max={100} step={0.1}
                  value={card.posTop}
                  onChange={(e) => card.setPosTop(+e.target.value)} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Left: {card.posLeft.toFixed(1)}%</label>
                <input style={s.range} type="range" min={0} max={100} step={0.1}
                  value={card.posLeft}
                  onChange={(e) => card.setPosLeft(+e.target.value)} />
              </div>
            </div>
            <div style={s.section}>
              <button style={s.btnReset} onClick={card.restoreDefaults}>Reset All</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Composant public — guard : actors non-null avant de rendre le panel ──────

export function DevControlPanel() {
  const {
    isRunning,
    bloomActor, lightingActor, pbrActor, materialActor,
    sceneActor, performanceActor, revelationActor, modelActor,
    visualPresetActor, neonBandsActor, steeringActor, scrollTextActor,
    cameraKeyframeActor, scrollCardActor,
  } = useOvermind();

  if (
    !isRunning ||
    !bloomActor || !lightingActor || !pbrActor || !materialActor ||
    !sceneActor || !performanceActor || !revelationActor || !modelActor ||
    !visualPresetActor || !neonBandsActor || !steeringActor || !scrollTextActor ||
    !cameraKeyframeActor || !scrollCardActor
  ) return null;

  return (
    <DevControlPanelContent
      bloomActor={bloomActor}
      lightingActor={lightingActor}
      pbrActor={pbrActor}
      materialActor={materialActor}
      sceneActor={sceneActor}
      performanceActor={performanceActor}
      revelationActor={revelationActor}
      modelActor={modelActor}
      visualPresetActor={visualPresetActor}
      neonBandsActor={neonBandsActor}
      steeringActor={steeringActor}
      scrollTextActor={scrollTextActor}
      cameraKeyframeActor={cameraKeyframeActor}
      scrollCardActor={scrollCardActor}
    />
  );
}
