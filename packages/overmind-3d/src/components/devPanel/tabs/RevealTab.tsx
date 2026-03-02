import type { useRevelation } from '../../../hooks/useRevelation.ts';
import { s } from '../styles.ts';

export function RevealTab({ revelation }: { revelation: ReturnType<typeof useRevelation> }) {
  return (
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
  );
}
