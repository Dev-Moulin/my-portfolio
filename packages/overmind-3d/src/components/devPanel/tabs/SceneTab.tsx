import type { useScene } from '../../../hooks/useScene.ts';
import { s } from '../styles.ts';

export function SceneTab({ scene }: { scene: ReturnType<typeof useScene> }) {
  return (
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
  );
}
