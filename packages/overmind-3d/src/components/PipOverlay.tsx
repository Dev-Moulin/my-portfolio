import { useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { sceneMachine } from '../machines/sceneMachine.ts';

const TIMELINE_HEIGHT = 180; // matches PANEL_HEIGHT_EXPANDED

const btnStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid #555',
  borderRadius: 3,
  color: '#ccc',
  fontSize: '10px',
  padding: '1px 5px',
  cursor: 'pointer',
  lineHeight: 1.4,
};

export function PipOverlay({
  sceneActor,
}: {
  sceneActor: ActorRefFrom<typeof sceneMachine>;
}) {
  const pipVisible = useSelector(sceneActor, (s) => s.context.pipVisible);
  const pipSize = useSelector(sceneActor, (s) => s.context.pipSize);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Notify scene system when controls div mounts/unmounts (for OrbitControls)
  useEffect(() => {
    if (controlsRef.current && pipVisible) {
      window.dispatchEvent(
        new CustomEvent('overmind:pip-overlay-mount', { detail: controlsRef.current }),
      );
    }
    return () => {
      window.dispatchEvent(new CustomEvent('overmind:pip-overlay-unmount'));
    };
  }, [pipVisible]);

  if (!pipVisible) return null;

  const w = pipSize === 'S' ? 200 : 400;
  const h = pipSize === 'S' ? 150 : 300;

  return (
    <div
      style={{
        position: 'fixed',
        right: 10,
        bottom: TIMELINE_HEIGHT + 10,
        width: w,
        height: h,
        border: '1px solid #333',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 9997,
        overflow: 'hidden',
      }}
    >
      {/* OrbitControls target — separate div so buttons don't conflict */}
      <div
        ref={controlsRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
        }}
      />
      {/* Buttons overlay — above OrbitControls div */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          right: 3,
          display: 'flex',
          gap: 3,
          zIndex: 2,
          pointerEvents: 'auto',
        }}
      >
        <button
          style={btnStyle}
          onClick={() =>
            sceneActor.send({
              type: 'SET_PIP_SIZE',
              size: pipSize === 'S' ? 'L' : 'S',
            })
          }
        >
          {pipSize === 'S' ? 'L' : 'S'}
        </button>
        <button
          style={btnStyle}
          onClick={() => sceneActor.send({ type: 'TOGGLE_PIP' })}
        >
          &times;
        </button>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          left: 4,
          fontSize: '9px',
          color: '#555',
          fontFamily: '"Courier New", monospace',
          pointerEvents: 'none',
        }}
      >
        PIP {pipSize}
      </div>
    </div>
  );
}
