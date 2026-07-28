import { useState, useEffect, useRef, useCallback } from 'react';
import { useOvermind } from '../hooks/useOvermind.ts';
import { useTimeline } from '../hooks/useTimeline.ts';
import type { ActorRefFrom } from 'xstate';
import type { timelineMachine } from '../machines/timelineMachine.ts';

// ── Timing (ms) ─────────────────────────────────────────────────────────────
const FLIP_DURATION = 600;
const SCALE_DURATION = 400;

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    zIndex: 10,
    perspective: '1000px',
    pointerEvents: 'none' as const,
  },
  scaler: {
    transformOrigin: 'top right',
    transition: `transform ${SCALE_DURATION}ms ease`,
  },
  flipper: {
    width: '380px',
    minHeight: '280px',
    transformStyle: 'preserve-3d' as const,
    transition: `transform ${FLIP_DURATION}ms ease`,
    pointerEvents: 'auto' as const,
  },
  face: {
    position: 'absolute' as const,
    inset: 0,
    backfaceVisibility: 'hidden' as const,
    borderRadius: '20px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  front: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderLeftColor: 'rgba(255,255,255,0.2)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
  },
  back: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderLeftColor: 'rgba(255,255,255,0.2)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
    transform: 'rotateY(180deg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    objectFit: 'cover' as const,
    background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))',
  },
  name: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  role: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.4,
  },
  links: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    textDecoration: 'none',
    fontSize: '18px',
    transition: 'all 0.2s ease',
  },
  cvButton: {
    marginTop: 'auto',
    padding: '8px 0',
    borderRadius: '10px',
    background: 'rgba(59,130,246,0.3)',
    border: '1px solid rgba(59,130,246,0.4)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
  },
  cvPreview: {
    flex: 1,
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
    overflowY: 'auto' as const,
  },
  backButton: {
    padding: '6px 0',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
  },
  downloadButton: {
    display: 'block',
    padding: '6px 0',
    borderRadius: '10px',
    background: 'rgba(59,130,246,0.3)',
    border: '1px solid rgba(59,130,246,0.4)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
  },
};

// ── SVG icons (inline to avoid external deps) ──────────────────────────────

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function ScrollCard() {
  const { timelineActor } = useOvermind();
  if (!timelineActor) return null;
  return <ScrollCardContent actorRef={timelineActor} />;
}

// ── CSS3D version (rendered via portal in SceneRenderer) ─────────────────────

export function ScrollCardContent3D({
  actorRef,
  instanceId = 'card',
}: {
  actorRef: ActorRefFrom<typeof timelineMachine>;
  instanceId?: string;
}) {
  const { computed } = useTimeline(actorRef);
  const cardComputed = instanceId === 'card'
    ? computed.card
    : { opacity: computed.instanceOpacities[instanceId] ?? 0, translateX: 0 };
  const [flipped, setFlipped] = useState(false);
  const [scaled, setScaled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleOpen = useCallback(() => {
    setFlipped(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setScaled(true), FLIP_DURATION);
  }, []);

  const handleClose = useCallback(() => {
    setScaled(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlipped(false), SCALE_DURATION);
  }, []);

  // Reset when card fades out (scroll back before card range)
  useEffect(() => {
    if (cardComputed.opacity <= 0 && (flipped || scaled)) {
      clearTimeout(timerRef.current);
      setScaled(false);
      setFlipped(false);
    }
  }, [cardComputed.opacity, flipped, scaled]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div style={{ width: '380px', minHeight: '280px' }}>
      {/* Scale wrapper */}
      <div style={{
        ...styles.scaler,
        transform: scaled ? 'scale(3)' : 'scale(1)',
      }}>
        {/* Flip wrapper */}
        <div style={{
          ...styles.flipper,
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* ── Front face ── */}
          <div style={{ ...styles.face, ...styles.front }}>
            <div style={styles.header}>
              <div style={styles.avatar} />
              <div>
                <h2 style={styles.name}>Paul Moulin</h2>
                <p style={styles.role}>Web3 Full-Stack Developer<br/>& 3D Enthusiast</p>
              </div>
            </div>

            <div style={styles.links}>
              <a href="https://github.com/Paulmusic" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="GitHub">
                <GitHubIcon />
              </a>
              <a href="https://x.com/" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="X / Twitter">
                <XIcon />
              </a>
              <a href="https://linkedin.com/in/" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>

            <button
              style={styles.cvButton}
              onClick={handleOpen}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View CV
            </button>
          </div>

          {/* ── Back face (CV) ── */}
          <div style={{ ...styles.face, ...styles.back }}>
            <div style={styles.cvPreview}>
              <strong>Paul Moulin</strong><br/>
              Web3 Full-Stack Developer & 3D Enthusiast<br/><br/>
              Building Decentralized Experiences<br/>
              Contributing to the Future of Trust<br/><br/>
              <em>CV content coming soon...</em>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                style={{ ...styles.backButton, flex: 1 }}
                onClick={handleClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                Back
              </button>
              <a
                href={import.meta.env.BASE_URL + 'cv.pdf'}
                download="CV Paul Moulin — Full-Stack, Web & 3D.pdf"
                style={{ ...styles.downloadButton, flex: 1 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
                }}
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legacy HTML overlay version (kept for fallback) ──────────────────────────

function ScrollCardContent({ actorRef }: { actorRef: ActorRefFrom<typeof timelineMachine> }) {
  const { cardEnabled, cardPosTop, cardPosLeft, computed, setCardPosTop, setCardPosLeft } = useTimeline(actorRef);
  const [flipped, setFlipped] = useState(false);
  const [scaled, setScaled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [freeCameraMode, setFreeCameraMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, top: 0, left: 0 });

  // Listen for free camera mode toggle
  useEffect(() => {
    const handler = (e: Event) => {
      setFreeCameraMode((e as CustomEvent).detail === 'free');
    };
    window.addEventListener('overmind:camera-mode', handler);
    return () => window.removeEventListener('overmind:camera-mode', handler);
  }, []);

  // Drag handlers for repositioning card in free camera mode
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!freeCameraMode) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, top: cardPosTop, left: cardPosLeft };
  }, [freeCameraMode, cardPosTop, cardPosLeft]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartRef.current.x) / window.innerWidth * 100;
      const dy = (e.clientY - dragStartRef.current.y) / window.innerHeight * 100;
      setCardPosLeft(dragStartRef.current.left + dx);
      setCardPosTop(dragStartRef.current.top + dy);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, setCardPosLeft, setCardPosTop]);

  const handleOpen = useCallback(() => {
    setFlipped(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setScaled(true), FLIP_DURATION);
  }, []);

  const handleClose = useCallback(() => {
    setScaled(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlipped(false), SCALE_DURATION);
  }, []);

  // Reset when card exits viewport (scroll back before card range)
  useEffect(() => {
    if (computed.card.opacity <= 0 && (flipped || scaled)) {
      clearTimeout(timerRef.current);
      setScaled(false);
      setFlipped(false);
    }
  }, [computed.card.opacity, flipped, scaled]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const { opacity: cardOpacity, translateX: cardTranslateX } = computed.card;

  if (!cardEnabled || cardOpacity <= 0) return null;

  return (
    <div
      onMouseDown={handleDragStart}
      style={{
        ...styles.wrapper,
        top: `${cardPosTop}%`,
        left: `${cardPosLeft}%`,
        opacity: cardOpacity,
        transform: `translate(-50%, -50%) translateX(${cardTranslateX}%)`,
        pointerEvents: cardOpacity > 0.5 ? 'auto' : 'none',
        cursor: freeCameraMode ? (dragging ? 'grabbing' : 'grab') : 'default',
      }}>
      {/* Scale wrapper — grows from top-right toward bottom-left */}
      <div style={{
        ...styles.scaler,
        transform: scaled ? 'scale(3)' : 'scale(1)',
      }}>
        {/* Flip wrapper */}
        <div style={{
          ...styles.flipper,
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* ── Front face ── */}
          <div style={{ ...styles.face, ...styles.front }}>
            <div style={styles.header}>
              <div style={styles.avatar} />
              <div>
                <h2 style={styles.name}>Paul Moulin</h2>
                <p style={styles.role}>Web3 Full-Stack Developer<br/>& 3D Enthusiast</p>
              </div>
            </div>

            <div style={styles.links}>
              <a href="https://github.com/Paulmusic" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="GitHub">
                <GitHubIcon />
              </a>
              <a href="https://x.com/" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="X / Twitter">
                <XIcon />
              </a>
              <a href="https://linkedin.com/in/" target="_blank" rel="noopener noreferrer"
                style={styles.link} title="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>

            <button
              style={styles.cvButton}
              onClick={handleOpen}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View CV
            </button>
          </div>

          {/* ── Back face (CV) ── */}
          <div style={{ ...styles.face, ...styles.back }}>
            <div style={styles.cvPreview}>
              <strong>Paul Moulin</strong><br/>
              Web3 Full-Stack Developer & 3D Enthusiast<br/><br/>
              Building Decentralized Experiences<br/>
              Contributing to the Future of Trust<br/><br/>
              <em>CV content coming soon...</em>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                style={{ ...styles.backButton, flex: 1 }}
                onClick={handleClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                Back
              </button>
              <a
                href={import.meta.env.BASE_URL + 'cv.pdf'}
                download="CV Paul Moulin — Full-Stack, Web & 3D.pdf"
                style={{ ...styles.downloadButton, flex: 1 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
                }}
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
