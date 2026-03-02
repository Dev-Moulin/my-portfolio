import { s } from '../styles.ts';

interface CardAlias {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  posTop: number;
  setPosTop: (v: number) => void;
  posLeft: number;
  setPosLeft: (v: number) => void;
  restoreDefaults: () => void;
}

export function CardTab({ card }: { card: CardAlias }) {
  return (
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
  );
}
