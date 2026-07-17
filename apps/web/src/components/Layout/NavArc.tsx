// src/components/layout/NavArc.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';
import '../../styles/components/navArc.css';

// Icônes
import HomeIcon from "../icons/HomeIcon";
import ProjectsIcon from "../icons/ProjectsIcon";
import AboutIcon from "../icons/AboutIcon";
import ContactIcon from "../icons/ContactIcon";
import LanguageIcon from "../icons/LanguageIcon";

const BLOOM_COLOR_KEY = "portfolio-bloom-color";
const DEFAULT_BLOOM_COLOR = "#ffffff";
const SLIDER_WIDTH = 200;
// Base Vite ('/' en dev, sous-chemin en prod) — préfixe des assets de public/.
const ASSET = import.meta.env.BASE_URL;
// Diamètre des pastilles PHOTO (bouton = 52px). 42 → ~5px de marge (retour Paul : 32=trop, 52=trop peu).
const PHOTO_SIZE = 42;

// --- Utilitaires couleur ---
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = ((b - r) / d + 2);
  else h = ((r - g) / d + 4);
  return Math.round(h * 60);
}

// Color icon — cercle rempli de la couleur du bloom
function ColorIcon({ size = 32, color }: { size?: number; color: string }) {
  const r = size / 2 - 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
    </svg>
  );
}

// Function to calculate responsive values
const getResponsiveValues = () => {
  if (typeof window === "undefined") return { radius: 120, bottomOffset: -200 };

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const baseRadius = 120;
  const responsiveRadius = Math.min(
    baseRadius,
    screenWidth * 0.25,
    screenHeight * 0.2
  );

  const baseBottomOffset = -200;
  const responsiveBottomOffset = Math.max(
    baseBottomOffset,
    -(screenHeight * 0.15)
  );

  return { radius: responsiveRadius, bottomOffset: responsiveBottomOffset };
};

type RestPoint = 'A' | 'B' | 'C' | 'D' | 'E';
type NavAction = 'language' | 'color';

interface NavItem {
  Icon: React.ComponentType<{ size?: number }> | null;
  /** suffixe de clé i18n : t(`navArc.${key}`) pour le libellé/tooltip */
  key: string;
  /** item de navigation caméra → saute au point de repos (via transition glitch) */
  point?: RestPoint;
  /** item d'action (toggle langue / slider couleur) */
  action?: NavAction;
  /** icône-PHOTO (URL public/) rendue en pastille ronde — prioritaire sur Icon si présent */
  img?: string;
  /** object-position CSS pour recadrer la photo dans le rond (défaut 'center') */
  imgPosition?: string;
  /** zoom (scale) de la photo dans le rond, pour recadrer serré (ex : œil petit dans son fond) */
  imgScale?: number;
}

/**
 * Items de la NavArc (site 3D). Réalité ÉCRAN :
 * B=Profil, C=Overmind 3D, D=OFC (Overmind Founders Collection), E=Extension Chrome (carte E, V2.9.1).
 * Home (A) RETIRÉ (2026-07-17) : le visiteur ne "revient pas à l'accueil", il tourne dans la boucle
 * des cartes → Profil devient le 1er bouton, tout est décalé d'une case, toujours 4 boutons portfolio.
 * ⚠️ Extension réutilise HomeIcon en PLACEHOLDER (pas d'`img`) jusqu'à la vraie image trouvée par Paul.
 */
const portfolioItems: NavItem[] = [
  { Icon: ProjectsIcon, key: 'profil', point: 'B', img: `${ASSET}images/profile.jpg`, imgPosition: 'center' },
  { Icon: ContactIcon, key: 'overmind3d', point: 'C', img: `${ASSET}images/overmind3d.png`, imgPosition: '50% 47%', imgScale: 2.15 },
  { Icon: AboutIcon, key: 'ofc', point: 'D', img: `${ASSET}images/ofc.webp`, imgPosition: '50% 32%' },
  { Icon: HomeIcon, key: 'chromeExtension', point: 'E' },
  { Icon: LanguageIcon, key: 'language', action: 'language' },
  { Icon: null, key: 'color', action: 'color' },
];

const NavArc = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bloomColor, setBloomColor] = useState(() =>
    localStorage.getItem(BLOOM_COLOR_KEY) || DEFAULT_BLOOM_COLOR
  );
  const [colorSliderOpen, setColorSliderOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  const [responsiveValues, setResponsiveValues] = useState(getResponsiveValues());

  const label = (item: NavItem) => t(`navArc.${item.key}`);

  useEffect(() => {
    const handleResize = () => {
      setResponsiveValues(getResponsiveValues());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Item actif = point de repos courant de la caméra (gauge), plus le scroll DOM.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ currentPoint?: RestPoint }>).detail;
      const point = detail?.currentPoint ?? 'A';
      const newIndex = portfolioItems.findIndex(item => item.point === point);
      setActiveIndex(prev => (newIndex !== -1 && newIndex !== prev ? newIndex : prev));
    };
    window.addEventListener('overmind:scroll-gauge-update', handler);
    return () => window.removeEventListener('overmind:scroll-gauge-update', handler);
  }, []);

  // Fermer le slider si on clique en dehors
  useEffect(() => {
    if (!colorSliderOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(e.target as Node)) {
        setColorSliderOpen(false);
      }
    };
    // Délai pour ne pas fermer immédiatement au clic d'ouverture
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [colorSliderOpen]);

  const applyColor = useCallback((color: string) => {
    setBloomColor(color);
    localStorage.setItem(BLOOM_COLOR_KEY, color);
    window.dispatchEvent(new CustomEvent('overmind:set-bloom-color', { detail: color }));
  }, []);

  // Calculer le hue depuis la position X sur le slider
  const hueFromEvent = useCallback((clientX: number) => {
    if (!sliderRef.current) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 360);
  }, []);

  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const hue = hueFromEvent(e.clientX);
    applyColor(hslToHex(hue, 100, 50));
  }, [hueFromEvent, applyColor]);

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const hue = hueFromEvent(e.clientX);
    applyColor(hslToHex(hue, 100, 50));
  }, [isDragging, hueFromEvent, applyColor]);

  const handleSliderPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const centralItem = portfolioItems[activeIndex];

  const getSecondaryItems = () => {
    return portfolioItems.filter((_, idx) => idx !== activeIndex);
  };

  const onHoverEnter = () => setIsOpen(true);
  const onHoverLeave = () => {
    if (!colorSliderOpen) setIsOpen(false);
  };

  const handleClick = (idx: number) => {
    try {
      const secondaryItems = getSecondaryItems();
      const clickedItem = secondaryItems[idx];

      if (clickedItem?.action === 'color') {
        setColorSliderOpen(prev => !prev);
        return;
      }

      if (clickedItem?.action === 'language') {
        const newLang = i18n.language === 'en' ? 'fr' : 'en';
        i18n.changeLanguage(newLang);
        return;
      }

      if (clickedItem?.point) {
        // Saut caméra masqué par la transition glitch (TransitionOverlay déclenche le camera-jump).
        window.dispatchEvent(new CustomEvent('overmind:nav-transition', { detail: clickedItem.point }));
      }
      setIsOpen(false);
    } catch (error) {
      console.warn('Navigation error:', error);
    }
  };

  const getButtonPosition = (idx: number, _total: number) => {
    if (idx === -1) {
      return { left: "50%", bottom: "30px", transform: "translateX(-50%)" };
    }

    const secondaryItems = getSecondaryItems();
    const totalSecondaryButtons = secondaryItems.length;
    const startAngle = Math.PI;
    const totalAngle = Math.PI;
    const angleStep = totalAngle / (totalSecondaryButtons - 1);
    const angle = startAngle - (idx * angleStep);
    const radius = responsiveValues.radius;
    const x = radius * Math.cos(angle);
    const y = Math.abs(radius * Math.sin(angle));

    return {
      left: `calc(50% + ${x}px)`,
      bottom: `calc(30px + ${y}px)`,
      transform: "translateX(-50%)"
    };
  };

  if (typeof window === "undefined") return null;

  const secondaryItems = getSecondaryItems();
  const colorBtnIndex = secondaryItems.findIndex(i => i.action === 'color');
  const colorBtnPos = colorBtnIndex !== -1 ? getButtonPosition(colorBtnIndex, secondaryItems.length) : null;
  const currentHue = hexToHue(bloomColor);
  const thumbPercent = currentHue / 360 * 100;

  const renderIcon = (item: NavItem, size: number) => {
    if (item.img) {
      // Pastille photo REMPLISSANT le bouton (wrapper rond en overflow hidden pour clipper le
      // zoom éventuel) — recadrée en CSS (cover + object-position + scale). `size` ignoré : la
      // photo prend 100 % du bouton (moins le liseré) pour ne plus laisser de marge.
      return (
        <div style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={item.img}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%', display: 'block',
              objectFit: 'cover', objectPosition: item.imgPosition ?? 'center',
              transform: item.imgScale ? `scale(${item.imgScale})` : undefined,
            }}
          />
        </div>
      );
    }
    if (item.action === 'color') {
      return <ColorIcon size={size} color={bloomColor} />;
    }
    if (item.Icon === ContactIcon) {
      return <ContactIcon size={size} variant={item === centralItem ? "primary" : "secondary"} />;
    }
    if (item.Icon) {
      return <item.Icon size={size} />;
    }
    return null;
  };

  const languageTooltip = i18n.language === 'en'
    ? t('common.switchToFrench')
    : t('common.switchToEnglish');

  return createPortal(
    <>
      {/* Background */}
      <div className={`arc-background ${isOpen ? "is-open" : ""}`} />

      <div
        ref={containerRef}
        className={`arc-menu-container ${isOpen ? "is-open" : ""}`}
        onMouseLeave={onHoverLeave}
      >
        <div className="arc-interaction-zone">
          {/* Bouton central */}
          <button
            className={`arc-menu-button central-button ${isOpen ? "is-open" : ""}`}
            style={getButtonPosition(-1, 1)}
            onMouseEnter={onHoverEnter}
            title={label(centralItem)}
          >
            {renderIcon(centralItem, 32)}
          </button>

          {/* Boutons secondaires */}
          {secondaryItems.map((item, idx) => {
            // Le bouton Color est caché quand le slider est ouvert
            if (item.action === 'color' && colorSliderOpen) return null;

            return (
              <button
                key={item.key}
                className={`arc-menu-button secondary-button ${isOpen ? "is-open" : ""}`}
                style={getButtonPosition(idx, secondaryItems.length)}
                onClick={() => handleClick(idx)}
                title={item.action === 'language' ? languageTooltip : label(item)}
              >
                {renderIcon(item, 32)}
              </button>
            );
          })}

          {/* Slider chromatique déployable — remplace le bouton Color quand ouvert */}
          {colorSliderOpen && colorBtnPos && (
            <div
              ref={sliderRef}
              className="arc-color-slider"
              style={{
                ...colorBtnPos,
                width: `${SLIDER_WIDTH}px`,
                pointerEvents: 'auto',
              }}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
            >
              {/* Track chromatique */}
              <div className="arc-color-slider-track" />
              {/* Thumb indicateur */}
              <div
                className="arc-color-slider-thumb"
                style={{ left: `${thumbPercent}%`, backgroundColor: bloomColor }}
              />
            </div>
          )}
        </div>
      </div>

      <div className={`arc-overlay ${isOpen ? "is-open" : ""}`} />
    </>,
    document.body
  );
};

export default NavArc;
