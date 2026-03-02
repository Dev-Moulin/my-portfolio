import type { useSteering } from '../../../hooks/useSteering.ts';
import { s } from '../styles.ts';

export function SteeringTab({ steering }: { steering: ReturnType<typeof useSteering> }) {
  return (
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
  );
}
