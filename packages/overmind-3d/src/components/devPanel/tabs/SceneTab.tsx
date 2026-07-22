import { useState } from 'react';
import type { useScene } from '../../../hooks/useScene.ts';
import { s } from '../styles.ts';

/** Sliders vitesse + scale d'un anneau — dispatch overmind:rings-config (écouté par SceneRenderer). */
function RingControls({ ring, defaultSpeed }: { ring: 1 | 2; defaultSpeed: number }) {
  const [speed, setSpeed] = useState(defaultSpeed);
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
  const dispatch = (detail: { ring: 1 | 2; speed?: number; scaleX?: number; scaleY?: number; scaleZ?: number }) =>
    window.dispatchEvent(new CustomEvent('overmind:rings-config', { detail }));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>
        Anneau {ring} {ring === 1 ? '(Anneaux_gameasset)' : '(Anneaux — contre-rotatif)'}
      </div>
      <div style={s.row}>
        <label style={s.label}>Vitesse: {speed.toFixed(2)} rad/s</label>
        <input style={s.range} type="range" min="-0.6" max="0.6" step="0.01" value={speed}
          onChange={(e) => { const v = +e.target.value; setSpeed(v); dispatch({ ring, speed: v }); }} />
      </div>
      {(['x', 'y', 'z'] as const).map(axis => (
        <div style={s.row} key={axis}>
          <label style={s.label}>Scale {axis.toUpperCase()}: {scale[axis].toFixed(2)}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.01" value={scale[axis]}
            onChange={(e) => {
              const v = +e.target.value;
              setScale(prev => ({ ...prev, [axis]: v }));
              dispatch({ ring, [axis === 'x' ? 'scaleX' : axis === 'y' ? 'scaleY' : 'scaleZ']: v });
            }} />
        </div>
      ))}
    </div>
  );
}

/** Debug sentinelle : sphère wander + éditeur de courbe AB (à la Blender). */
function SentinelDebugControls() {
  const [zones, setZones] = useState(false);
  const [trajectories, setTrajectories] = useState(false);
  const [editCam, setEditCam] = useState(false);
  const [entryBack, setEntryBack] = useState(10);
  const [entryUp, setEntryUp] = useState(15);
  const [entryCatch, setEntryCatch] = useState(0.14);
  const dispatchEntry = (detail: { back?: number; up?: number; catchUp?: number; export?: boolean }) =>
    window.dispatchEvent(new CustomEvent('overmind:sentinel-entry', { detail }));
  return (
    <div>
      <div style={s.row}>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={zones}
            onChange={(e) => {
              setZones(e.target.checked);
              window.dispatchEvent(new CustomEvent('overmind:sentinel-debug', { detail: { zones: e.target.checked } }));
            }} />
          Zones wander B/C/D (sphères)
        </label>
      </div>
      <div style={s.row}>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={trajectories}
            onChange={(e) => {
              setTrajectories(e.target.checked);
              window.dispatchEvent(new CustomEvent('overmind:sentinel-debug', { detail: { trajectories: e.target.checked } }));
            }} />
          Trajectoires wander (lignes)
        </label>
      </div>
      <div style={{ color: '#666', fontSize: 10, margin: '8px 0 4px' }}>Entrée AB (plongeon depuis hors-champ). Va d'abord en A.</div>
      <div style={s.row}>
        <label style={s.label}>Recul: {entryBack.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="40" step="0.5" value={entryBack}
          onChange={(e) => { const v = +e.target.value; setEntryBack(v); dispatchEntry({ back: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Hauteur: {entryUp.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="40" step="0.5" value={entryUp}
          onChange={(e) => { const v = +e.target.value; setEntryUp(v); dispatchEntry({ up: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Rattrapage: {(entryCatch * 100).toFixed(0)}%</label>
        <input style={s.range} type="range" min="0.05" max="0.6" step="0.01" value={entryCatch}
          onChange={(e) => { const v = +e.target.value; setEntryCatch(v); dispatchEntry({ catchUp: v }); }} />
      </div>
      <button style={s.btnReset} onClick={() => dispatchEntry({ export: true })}>
        Export entrée (console)
      </button>

      <div style={{ color: '#666', fontSize: 10, margin: '8px 0 4px' }}>Trajectoire caméra AB (frames 53-260). Scrolle AB pour voir.</div>
      <div style={s.row}>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={editCam}
            onChange={(e) => {
              setEditCam(e.target.checked);
              window.dispatchEvent(new CustomEvent('overmind:camera-editor', { detail: { enabled: e.target.checked } }));
            }} />
          Éditer caméra AB (poignées + G)
        </label>
      </div>
      <button style={s.btnReset} disabled={!editCam}
        onClick={() => window.dispatchEvent(new CustomEvent('overmind:camera-editor', { detail: { export: true } }))}>
        Export caméra (console)
      </button>
    </div>
  );
}

type ParticlesDetail = {
  speed?: number; count?: number; shipScale?: number; showPaths?: boolean;
  fadeZone?: { start: number; end: number };
  motion?: {
    spread?: number; speedVar?: number; laneAmp?: number;
    swayAmp?: number; swayFreq?: number; rollFraction?: number; bank?: number;
  };
  circuits?: { count: number; angleDeg: number };
};
const dispatchParticles = (detail: ParticlesDetail) =>
  window.dispatchEvent(new CustomEvent('overmind:particles-config', { detail }));

/** Mini-vaisseaux : circuit fermé (courbe Bézier). Vitesse, densité, taille, + zone de
 *  disparition |Z| aux extrémités (cache les demi-tours → illusion de flux linéaire). */
function MiniShipControls() {
  const [speed, setSpeed] = useState(7);
  const [count, setCount] = useState(114);
  const [shipScale, setShipScale] = useState(0.15);
  const [fadeStart, setFadeStart] = useState(300);
  const [fadeEnd, setFadeEnd] = useState(340);
  const [showPaths, setShowPaths] = useState(false);
  // Vie / mouvement (A dispersion, A vitesse, B voies, C houle ampl/fréq, D vrilles, E banking)
  const [spread, setSpread] = useState(0.7);
  const [speedVar, setSpeedVar] = useState(0);
  const [laneAmp, setLaneAmp] = useState(3);
  const [swayAmp, setSwayAmp] = useState(2);
  const [swayFreq, setSwayFreq] = useState(1.2);
  const [rollFraction, setRollFraction] = useState(0.18);
  const [bank, setBank] = useState(0.5);
  const [circuitsCount, setCircuitsCount] = useState(2);
  const [circuitAngle, setCircuitAngle] = useState(11);
  const pushFade = (start: number, end: number) => dispatchParticles({ fadeZone: { start, end } });
  const pushMotion = (m: NonNullable<ParticlesDetail['motion']>) => dispatchParticles({ motion: m });
  const pushCircuits = (count: number, angleDeg: number) => dispatchParticles({ circuits: { count, angleDeg } });
  return (
    <div>
      <div style={s.row}>
        <label style={s.label}>Vitesse: {speed.toFixed(0)}</label>
        <input style={s.range} type="range" min="0" max="30" step="0.5" value={speed}
          onChange={(e) => { const v = +e.target.value; setSpeed(v); dispatchParticles({ speed: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Nombre / boucle: {count}</label>
        <input style={s.range} type="range" min="0" max="200" step="1" value={count}
          onChange={(e) => { const v = +e.target.value; setCount(v); dispatchParticles({ count: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Boucles (nb): {circuitsCount}</label>
        <input style={s.range} type="range" min="1" max="6" step="1" value={circuitsCount}
          onChange={(e) => { const v = +e.target.value; setCircuitsCount(v); pushCircuits(v, circuitAngle); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Écart boucles (°): {circuitAngle}</label>
        <input style={s.range} type="range" min="0" max="60" step="1" value={circuitAngle}
          onChange={(e) => { const v = +e.target.value; setCircuitAngle(v); pushCircuits(circuitsCount, v); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Taille vaisseaux: {shipScale.toFixed(2)}</label>
        <input style={s.range} type="range" min="0.05" max="3" step="0.05" value={shipScale}
          onChange={(e) => { const v = +e.target.value; setShipScale(v); dispatchParticles({ shipScale: v }); }} />
      </div>
      <div style={{ color: '#888', fontSize: 11, margin: '8px 0 2px' }}>
        Zone de disparition |Z| — cache les demi-tours aux extrémités du circuit :
      </div>
      <div style={s.row}>
        <label style={s.label}>Début fondu: {fadeStart}</label>
        <input style={s.range} type="range" min="0" max="350" step="5" value={fadeStart}
          onChange={(e) => { const v = +e.target.value; setFadeStart(v); pushFade(v, fadeEnd); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Caché total: {fadeEnd}</label>
        <input style={s.range} type="range" min="0" max="350" step="5" value={fadeEnd}
          onChange={(e) => { const v = +e.target.value; setFadeEnd(v); pushFade(fadeStart, v); }} />
      </div>
      <div style={{ color: '#888', fontSize: 11, margin: '8px 0 2px' }}>
        Vie / mouvement — casse la « file indienne », rend l'essaim vivant :
      </div>
      <div style={s.row}>
        <label style={s.label}>Dispersion: {spread.toFixed(2)}</label>
        <input style={s.range} type="range" min="0" max="1" step="0.05" value={spread}
          onChange={(e) => { const v = +e.target.value; setSpread(v); pushMotion({ spread: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Variation vitesse: {speedVar.toFixed(2)}</label>
        <input style={s.range} type="range" min="0" max="1" step="0.05" value={speedVar}
          onChange={(e) => { const v = +e.target.value; setSpeedVar(v); pushMotion({ speedVar: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Voies (écart): {laneAmp.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="30" step="0.5" value={laneAmp}
          onChange={(e) => { const v = +e.target.value; setLaneAmp(v); pushMotion({ laneAmp: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Houle ampl.: {swayAmp.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="30" step="0.5" value={swayAmp}
          onChange={(e) => { const v = +e.target.value; setSwayAmp(v); pushMotion({ swayAmp: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Houle fréq.: {swayFreq.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="5" step="0.1" value={swayFreq}
          onChange={(e) => { const v = +e.target.value; setSwayFreq(v); pushMotion({ swayFreq: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Vrilles: {Math.round(rollFraction * 100)}%</label>
        <input style={s.range} type="range" min="0" max="1" step="0.02" value={rollFraction}
          onChange={(e) => { const v = +e.target.value; setRollFraction(v); pushMotion({ rollFraction: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Inclinaison (drone): {bank.toFixed(2)}</label>
        <input style={s.range} type="range" min="0" max="1" step="0.05" value={bank}
          onChange={(e) => { const v = +e.target.value; setBank(v); pushMotion({ bank: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={showPaths}
            onChange={(e) => { setShowPaths(e.target.checked); dispatchParticles({ showPaths: e.target.checked }); }} />
          Voir le circuit (courbe)
        </label>
      </div>
    </div>
  );
}

/** Vue élargie au repos : recul caméra + FOV par point (B/C/D/E). Dispatch overmind:rest-view. */
type RestViewPoint = 'B' | 'C' | 'D' | 'E';
// ⚠️ valeurs d'AFFICHAGE initial seulement (le vrai défaut runtime vit dans scrollCameraAnimator.restView).
// E = 1.5 : amorti d'arrivée (recul fondu), les autres sont bakés dans le GLB depuis V2.2.
const REST_VIEW_DEFAULTS: Record<RestViewPoint, number> = { B: 0, C: 0, D: 0, E: 1.5 };
function RestViewRow({ point }: { point: RestViewPoint }) {
  const [back, setBack] = useState(REST_VIEW_DEFAULTS[point]);
  const [fov, setFov] = useState(0);
  const dispatch = (detail: { point: RestViewPoint; back?: number; fov?: number }) =>
    window.dispatchEvent(new CustomEvent('overmind:rest-view', { detail }));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Point {point}</div>
      <div style={s.row}>
        <label style={s.label}>Recul: {back.toFixed(1)}</label>
        <input style={s.range} type="range" min="0" max="3" step="0.1" value={back}
          onChange={(e) => { const v = +e.target.value; setBack(v); dispatch({ point, back: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>FOV: {fov === 0 ? 'auto' : fov.toFixed(0) + '°'}</label>
        <input style={s.range} type="range" min="0" max="100" step="1" value={fov}
          onChange={(e) => { const v = +e.target.value; setFov(v); dispatch({ point, fov: v }); }} />
      </div>
    </div>
  );
}

function RestViewControls() {
  return (
    <div>
      <div style={{ color: '#666', fontSize: 10, marginBottom: 4 }}>Recul caméra + FOV à l'arrêt (0 = auto). Va d'abord en B/C/D/E.</div>
      {(['B', 'C', 'D', 'E'] as const).map((p) => <RestViewRow key={p} point={p} />)}
      <button style={s.btnReset}
        onClick={() => window.dispatchEvent(new CustomEvent('overmind:rest-view', { detail: { point: 'B', export: true } }))}>
        Export vues (console)
      </button>
    </div>
  );
}

/** Look-around souris : rotation douce de la « tête » caméra au repos (parallax) + FREE-LOOK
 *  360° (drag « tirer le monde », retour auto après inactivité). overmind:look-around. */
function LookAroundControls() {
  const [enabled, setEnabled] = useState(true);
  const [deadzonePct, setDeadzonePct] = useState(65); // % central SANS effet
  const [yawDeg, setYawDeg] = useState(18);
  const [pitchDeg, setPitchDeg] = useState(11);
  const [response, setResponse] = useState(0.45);
  const [freeSensDeg, setFreeSensDeg] = useState(0.08); // °/pixel de drag
  const [freePitchDeg, setFreePitchDeg] = useState(80);  // clamp pitch total
  const [freeIdle, setFreeIdle] = useState(3);           // s avant retour auto
  const [freeReturn, setFreeReturn] = useState(0.8);     // constante de temps du retour (s)
  const [freeInertia, setFreeInertia] = useState(0.4);   // glisse au relâcher (s)
  const dispatch = (detail: {
    enabled?: boolean; deadzone?: number; maxYaw?: number; maxPitch?: number; response?: number;
    freeSensitivity?: number; freePitchClamp?: number; freeIdleDelay?: number; freeReturnTime?: number; freeInertia?: number;
    export?: boolean;
  }) =>
    window.dispatchEvent(new CustomEvent('overmind:look-around', { detail }));
  return (
    <div>
      <div style={{ color: '#666', fontSize: 10, marginBottom: 4 }}>
        Au repos, la caméra tourne la tête vers le bord visé. Deadzone = centre sans effet (vise les ~{(100 - deadzonePct).toFixed(0)}% extérieurs).
      </div>
      <label style={{ ...s.label, display: 'flex', gap: 6, marginBottom: 4 }}>
        <input type="checkbox" checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); dispatch({ enabled: e.target.checked }); }} />
        Activé
      </label>
      <div style={s.row}>
        <label style={s.label}>Deadzone (centre): {deadzonePct}%</label>
        <input style={s.range} type="range" min={30} max={90} step={1} value={deadzonePct}
          onChange={(e) => { const v = +e.target.value; setDeadzonePct(v); dispatch({ deadzone: v / 100 }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Amplitude horiz.: {yawDeg}°</label>
        <input style={s.range} type="range" min={0} max={45} step={1} value={yawDeg}
          onChange={(e) => { const v = +e.target.value; setYawDeg(v); dispatch({ maxYaw: v * Math.PI / 180 }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Amplitude vert.: {pitchDeg}°</label>
        <input style={s.range} type="range" min={0} max={30} step={1} value={pitchDeg}
          onChange={(e) => { const v = +e.target.value; setPitchDeg(v); dispatch({ maxPitch: v * Math.PI / 180 }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Douceur (s): {response.toFixed(2)}</label>
        <input style={s.range} type="range" min={0.1} max={1.2} step={0.05} value={response}
          onChange={(e) => { const v = +e.target.value; setResponse(v); dispatch({ response: v }); }} />
      </div>
      <div style={{ color: '#666', fontSize: 10, margin: '8px 0 4px' }}>
        Free-look 360° : clic maintenu + glisser (« tirer le monde »). Sans activité, la vue
        revient d'elle-même vers le cadrage du point.
      </div>
      <div style={s.row}>
        <label style={s.label}>Sensibilité drag: {freeSensDeg.toFixed(2)}°/px</label>
        <input style={s.range} type="range" min={0.05} max={0.6} step={0.01} value={freeSensDeg}
          onChange={(e) => { const v = +e.target.value; setFreeSensDeg(v); dispatch({ freeSensitivity: v * Math.PI / 180 }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Pitch max: ±{freePitchDeg}°</label>
        <input style={s.range} type="range" min={20} max={89} step={1} value={freePitchDeg}
          onChange={(e) => { const v = +e.target.value; setFreePitchDeg(v); dispatch({ freePitchClamp: v * Math.PI / 180 }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Retour auto après: {freeIdle.toFixed(1)} s</label>
        <input style={s.range} type="range" min={1} max={15} step={0.5} value={freeIdle}
          onChange={(e) => { const v = +e.target.value; setFreeIdle(v); dispatch({ freeIdleDelay: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Douceur du retour (s): {freeReturn.toFixed(2)}</label>
        <input style={s.range} type="range" min={0.2} max={2.5} step={0.05} value={freeReturn}
          onChange={(e) => { const v = +e.target.value; setFreeReturn(v); dispatch({ freeReturnTime: v }); }} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Inertie au relâcher (s): {freeInertia.toFixed(2)}</label>
        <input style={s.range} type="range" min={0} max={1} step={0.05} value={freeInertia}
          onChange={(e) => { const v = +e.target.value; setFreeInertia(v); dispatch({ freeInertia: v }); }} />
      </div>
      <button style={s.btnReset} onClick={() => dispatch({ export: true })}>
        Export réglages (console)
      </button>
    </div>
  );
}

export function SceneTab({ scene }: { scene: ReturnType<typeof useScene> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Camera Goto (dev)</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['A', 'B', 'C', 'D'] as const).map(p => (
            <button
              key={p}
              onClick={() => window.dispatchEvent(new CustomEvent('overmind:camera-jump', { detail: p }))}
              style={{ flex: 1, padding: '6px 0', background: '#222', color: '#0cf', border: '1px solid #0cf', borderRadius: 3, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Anneaux</h3>
        <RingControls ring={1} defaultSpeed={0.12} />
        <RingControls ring={2} defaultSpeed={-0.12} />
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Vue élargie (B/C/D)</h3>
        <RestViewControls />
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Look-around souris</h3>
        <LookAroundControls />
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Sentinelle</h3>
        <SentinelDebugControls />
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Mini-vaisseaux</h3>
        <MiniShipControls />
      </div>
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
        <h3 style={s.h3}>Light Helpers</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={scene.lightHelpersVisible} onChange={scene.toggleLightHelpers} />
            Show Light Helpers
          </label>
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
        <div style={s.row}>
          <label style={s.label}>Near: {scene.near < 0.01 ? scene.near.toExponential(1) : scene.near.toFixed(3)}</label>
          <input style={s.range} type="range" min={-3} max={1} step={0.01}
            value={Math.log10(scene.near)}
            onChange={(e) => scene.updateNear(+(10 ** +e.target.value).toFixed(4))} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Far: {scene.far.toFixed(0)}</label>
          <input style={s.range} type="range" min={1} max={4} step={0.01}
            value={Math.log10(scene.far)}
            onChange={(e) => scene.updateFar(Math.round(10 ** +e.target.value))} />
        </div>
        <div style={s.infoBox}>
          <strong>Near/Far</strong> = clipping planes &middot;
          <strong>FOV</strong> = champ de vision (d&eacute;faut 45&deg;)
        </div>
      </div>
      <div style={s.section}>
        <button style={s.btnReset} onClick={scene.restoreDefaults}>Reset</button>
      </div>
    </div>
  );
}
