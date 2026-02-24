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

const portfolioItems = [
  { Icon: HomeIcon, label: "Home", section: "home" },
  { Icon: ProjectsIcon, label: "Projects", section: "projects" },
  { Icon: AboutIcon, label: "About", section: "about" },
  { Icon: ContactIcon, label: "Contact", section: "contact" },
  { Icon: LanguageIcon, label: "Language", section: null },
  { Icon: null, label: "Color", section: null }
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
  const { i18n } = useTranslation();
  const [responsiveValues, setResponsiveValues] = useState(getResponsiveValues());

  useEffect(() => {
    const handleResize = () => {
      setResponsiveValues(getResponsiveValues());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Détecter la section active en fonction du scroll
  useEffect(() => {
    const handleScroll = () => {
      try {
        const sections = portfolioItems
          .filter(item => item?.section)
          .map(item => document.getElementById(item.section!))
          .filter(Boolean);

        const scrollPosition = window.scrollY + window.innerHeight / 2;

        for (let i = sections.length - 1; i >= 0; i--) {
          const section = sections[i];
          if (section && section.offsetTop <= scrollPosition) {
            const newIndex = portfolioItems.findIndex(item => item?.section === section.id);
            if (newIndex !== -1 && newIndex !== activeIndex) {
              setActiveIndex(newIndex);
            }
            break;
          }
        }
      } catch (error) {
        console.warn('Scroll handler error:', error);
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeIndex]);

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

      if (clickedItem?.label === "Color") {
        setColorSliderOpen(prev => !prev);
        return;
      }

      if (clickedItem?.label === "Language") {
        const newLang = i18n.language === 'en' ? 'fr' : 'en';
        i18n.changeLanguage(newLang);
        return;
      }

      if (clickedItem?.section) {
        const element = document.getElementById(clickedItem.section);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
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
  const colorBtnIndex = secondaryItems.findIndex(i => i.label === "Color");
  const colorBtnPos = colorBtnIndex !== -1 ? getButtonPosition(colorBtnIndex, secondaryItems.length) : null;
  const currentHue = hexToHue(bloomColor);
  const thumbPercent = currentHue / 360 * 100;

  const renderIcon = (item: typeof portfolioItems[number], size: number) => {
    if (item.label === "Color") {
      return <ColorIcon size={size} color={bloomColor} />;
    }
    if (item.label === "Contact") {
      return <ContactIcon size={size} variant={item === centralItem ? "primary" : "secondary"} />;
    }
    if (item.Icon) {
      return <item.Icon size={size} />;
    }
    return null;
  };

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
            title={centralItem.label}
          >
            {renderIcon(centralItem, 32)}
          </button>

          {/* Boutons secondaires */}
          {secondaryItems.map((item, idx) => {
            // Le bouton Color est caché quand le slider est ouvert
            if (item.label === "Color" && colorSliderOpen) return null;

            return (
              <button
                key={item.label}
                className={`arc-menu-button secondary-button ${isOpen ? "is-open" : ""}`}
                style={getButtonPosition(idx, secondaryItems.length)}
                onClick={() => handleClick(idx)}
                title={item.label === "Language" ? `Switch to ${i18n.language === 'en' ? 'French' : 'English'}` : item.label}
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
