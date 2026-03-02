import type { useModel } from '../../../hooks/useModel.ts';
import { s } from '../styles.ts';

export function ModelTab({ model }: { model: ReturnType<typeof useModel> }) {
  return (
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
  );
}
