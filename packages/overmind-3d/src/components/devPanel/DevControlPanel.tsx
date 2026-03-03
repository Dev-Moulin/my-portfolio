import { useState, useRef, useEffect } from 'react';
import { useOvermind } from '../../hooks/useOvermind.ts';
import { useBloom } from '../../hooks/useBloom.ts';
import { useLighting } from '../../hooks/useLighting.ts';
import { usePBR } from '../../hooks/usePBR.ts';
import { useMaterial } from '../../hooks/useMaterial.ts';
import { useScene } from '../../hooks/useScene.ts';
import { usePerformance } from '../../hooks/usePerformance.ts';
import { useRevelation } from '../../hooks/useRevelation.ts';
import { useModel } from '../../hooks/useModel.ts';
import { useVisualPreset } from '../../hooks/useVisualPreset.ts';
import { useNeonBands } from '../../hooks/useNeonBands.ts';
import { useSteering } from '../../hooks/useSteering.ts';
import { useTimeline } from '../../hooks/useTimeline.ts';
import type { ContentProps, TabId } from './types.ts';
import { TABS } from './types.ts';
import { s, tabBtnSt } from './styles.ts';
import { PresetsTab } from './tabs/PresetsTab.tsx';
import { BloomTab } from './tabs/BloomTab.tsx';
import { NeonTab } from './tabs/NeonTab.tsx';
import { LightingTab } from './tabs/LightingTab.tsx';
import { PBRTab } from './tabs/PBRTab.tsx';
import { MaterialsTab } from './tabs/MaterialsTab.tsx';
import { SceneTab } from './tabs/SceneTab.tsx';
import { PerfTab } from './tabs/PerfTab.tsx';
import { RevealTab } from './tabs/RevealTab.tsx';
import { ModelTab } from './tabs/ModelTab.tsx';
import { SteeringTab } from './tabs/SteeringTab.tsx';
import { ScrollTextTab } from './tabs/ScrollTextTab.tsx';
import { OutlinerTab } from './tabs/OutlinerTab.tsx';
import { LibraryTab } from './tabs/LibraryTab.tsx';
import { useSelection } from '../../hooks/useSelection.ts';
import { useInstanceConfig } from '../../hooks/useInstanceConfig.ts';
import { useSceneSave } from '../../hooks/useSceneSave.ts';

// ─── Composant interne ────────────────────────────────────────────────────────

function DevControlPanelContent({
  bloomActor, lightingActor, pbrActor, materialActor,
  sceneActor, performanceActor, revelationActor, modelActor,
  visualPresetActor, neonBandsActor, steeringActor, timelineActor,
  selectionActor,
}: ContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Presets');
  const [htmlHidden, setHtmlHidden] = useState(true);

  // Start with HTML hidden
  useEffect(() => {
    document.body.classList.add('hide-html-content');
  }, []);

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

  // ── Hooks ───────────────────────────────────────────────────────────────────
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
  const timeline = useTimeline(timelineActor);
  const selection = useSelection(selectionActor);
  const instanceConfig = useInstanceConfig();
  const sceneSave = useSceneSave({
    bloom: bloomActor, lighting: lightingActor, pbr: pbrActor,
    material: materialActor, scene: sceneActor, model: modelActor,
    neonBands: neonBandsActor, steering: steeringActor,
    timeline: timelineActor, selection: selectionActor,
    visualPreset: visualPresetActor,
  });

  // Aliases for backward-compatible access in JSX (avoids renaming 100+ references)
  const scrollText = {
    scrollProgress: timeline.currentFrame,
    visible: timeline.textVisible,
    setVisible: timeline.setTextVisible,
    titleLayout: timeline.titleLayout,
    setTitleLayout: timeline.setTitleLayout,
    subtitleLayout: timeline.subtitleLayout,
    setSubtitleLayout: timeline.setSubtitleLayout,
    titleFontSize: timeline.titleFontSize,
    setTitleFontSize: timeline.setTitleFontSize,
    subtitleFontSize: timeline.subtitleFontSize,
    setSubtitleFontSize: timeline.setSubtitleFontSize,
    titleColor: timeline.titleColor,
    setTitleColor: timeline.setTitleColor,
    subtitleColor: timeline.subtitleColor,
    setSubtitleColor: timeline.setSubtitleColor,
    titleEmissiveIntensity: timeline.titleEmissiveIntensity,
    setTitleEmissive: timeline.setTitleEmissive,
    subtitleEmissiveIntensity: timeline.subtitleEmissiveIntensity,
    setSubtitleEmissive: timeline.setSubtitleEmissive,
    importLayout: timeline.importLayout,
    restoreDefaults: timeline.restoreDefaults,
  };
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTextFileInputRef = useRef<HTMLInputElement>(null);
  const sceneFileInputRef = useRef<HTMLInputElement>(null);

  // ── Visual keyframe capture via V shortcut ─────────────────────────────────
  // Use refs to avoid stale closures + excessive effect re-runs
  const bloomRef = useRef(bloom);
  bloomRef.current = bloom;
  const lightingRef = useRef(lighting);
  lightingRef.current = lighting;
  const materialRef = useRef(material);
  materialRef.current = material;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const neonRef = useRef(neon);
  neonRef.current = neon;
  const timelineVkRef = useRef(timeline);
  timelineVkRef.current = timeline;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      e.preventDefault();
      const b = bloomRef.current;
      const l = lightingRef.current;
      const m = materialRef.current;
      const sc = sceneRef.current;
      const n = neonRef.current;
      const tl = timelineVkRef.current;

      tl.addVisualKeyframe({
        at: Math.round(tl.currentFrame),
        duration: 30,
        enterDuration: 5,
        exitDuration: 5,
        easing: 'smoothstep',
        label: `V${tl.visualKeyframes.length + 1}`,
        bloom: {
          enabled: b.enabled,
          color: b.bloomColor,
          strength: b.strength,
          threshold: b.threshold,
          radius: b.radius,
        },
        lighting: {
          ambientIntensity: l.ambientIntensity,
          directionalIntensity: l.directionalIntensity,
          pointIntensity: l.pointIntensity,
          exposure: l.exposure,
          hdrBoostEnabled: l.hdrBoostEnabled,
          hdrBoostMultiplier: l.hdrBoostMultiplier,
        },
        material: {
          iris: { emissiveColor: m.iris.emissiveColor, emissiveIntensity: m.iris.emissiveIntensity },
          eyeRings: { emissiveColor: m.eyeRings.emissiveColor, emissiveIntensity: m.eyeRings.emissiveIntensity },
          revealRings: { emissiveColor: m.revealRings.emissiveColor, emissiveIntensity: m.revealRings.emissiveIntensity },
        },
        scene: { backgroundColor: sc.backgroundColor },
        neon: {
          flowSpeed: n.flowSpeed,
          flowEnabled: n.flowEnabled,
          globalIntensity: n.globalIntensity,
        },
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
          <button style={{ ...s.btnSm, background: '#16a34a', color: '#fff' }} onClick={() => sceneSave.exportScene()} title="Save scene (Ctrl+S)">Save</button>
          <button style={s.btnSm} onClick={() => sceneFileInputRef.current?.click()} title="Load scene">Load</button>
          <input ref={sceneFileInputRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) sceneSave.importScene(f); e.target.value = ''; }} />
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
        {activeTab === 'Presets' && <PresetsTab bloom={bloom} lighting={lighting} material={material} pbr={pbr} vPreset={vPreset} fileInputRef={fileInputRef} />}
        {activeTab === 'Bloom' && <BloomTab bloom={bloom} />}
        {activeTab === 'Neon' && <NeonTab neon={neon} />}
        {activeTab === 'Lighting' && <LightingTab lighting={lighting} />}
        {activeTab === 'PBR' && <PBRTab pbr={pbr} />}
        {activeTab === 'Materials' && <MaterialsTab material={material} />}
        {activeTab === 'Scene' && <SceneTab scene={scene} />}
        {activeTab === 'Perf' && <PerfTab perf={perf} />}
        {activeTab === 'Reveal' && <RevealTab revelation={revelation} />}
        {activeTab === 'Model' && <ModelTab model={model} />}
        {activeTab === 'Steering' && <SteeringTab steering={steering} />}
        {activeTab === 'ScrollText' && <ScrollTextTab scrollText={scrollText} scrollTextFileInputRef={scrollTextFileInputRef} />}
        {activeTab === 'Outliner' && <OutlinerTab selection={selection} instanceConfig={instanceConfig} />}
        {activeTab === 'Library' && <LibraryTab />}
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
    visualPresetActor, neonBandsActor, steeringActor, timelineActor,
    selectionActor,
  } = useOvermind();

  if (
    !isRunning ||
    !bloomActor || !lightingActor || !pbrActor || !materialActor ||
    !sceneActor || !performanceActor || !revelationActor || !modelActor ||
    !visualPresetActor || !neonBandsActor || !steeringActor || !timelineActor ||
    !selectionActor
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
      timelineActor={timelineActor}
      selectionActor={selectionActor}
    />
  );
}
