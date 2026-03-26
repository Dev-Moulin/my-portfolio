import type { useBloom } from '../../../hooks/useBloom.ts';
import type { useLights } from '../../../hooks/useLights.ts';
import type { useMaterial } from '../../../hooks/useMaterial.ts';
import type { usePBR } from '../../../hooks/usePBR.ts';
import type { useVisualPreset } from '../../../hooks/useVisualPreset.ts';
import { SITUATIONS } from '../../../data/defaultPresets.ts';
import type { Situation } from '../../../data/defaultPresets.ts';
import { s } from '../styles.ts';

const SITUATION_LABELS: Record<Situation, string> = {
  idle_disconnected: 'Idle (disconnected)',
  idle_connected: 'Idle (connected)',
  error: 'Error',
  alphabet_search: 'Alphabet Search',
  buy_success: 'Buy Success',
  afk: 'AFK',
};

export { SITUATION_LABELS };

interface PresetsTabProps {
  bloom: ReturnType<typeof useBloom>;
  lighting: ReturnType<typeof useLights>;
  material: ReturnType<typeof useMaterial>;
  pbr: ReturnType<typeof usePBR>;
  vPreset: ReturnType<typeof useVisualPreset>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function PresetsTab({ bloom, lighting, material, pbr, vPreset, fileInputRef }: PresetsTabProps) {
  return (
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
  );
}
