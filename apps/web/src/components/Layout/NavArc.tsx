// src/components/layout/NavArc.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';
import '../../styles/components/navArc.css';

// Icônes
import HomeIcon from "../icons/HomeIcon";
import ProjectsIcon from "../icons/ProjectsIcon";
import AboutIcon from "../icons/AboutIcon";
import ContactIcon from "../icons/ContactIcon";
import LanguageIcon from "../icons/LanguageIcon";
import GyroIcon from "../icons/GyroIcon";

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

  // Tactile : la formule desktop (H*0.2) écrase le rayon à ~64px sur un iPhone en paysage
  // (319px de haut) → boutons quasi superposés, impossibles à viser au doigt. On autorise
  // l'arc à monter plus haut (H*0.38) : les gestes sont des taps, pas du hover à traverser.
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  const baseRadius = 120;
  const responsiveRadius = coarse
    ? Math.min(140, screenWidth * 0.22, screenHeight * 0.38)
    : Math.min(baseRadius, screenWidth * 0.25, screenHeight * 0.2);

  const baseBottomOffset = -200;
  const responsiveBottomOffset = Math.max(
    baseBottomOffset,
    -(screenHeight * 0.15)
  );

  return { radius: responsiveRadius, bottomOffset: responsiveBottomOffset };
};

type RestPoint = 'A' | 'B' | 'C' | 'D' | 'E';
type NavAction = 'language' | 'color' | 'gyro';

const isCoarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** iOS ≥13 : la lecture du gyroscope exige une permission demandée DANS le geste utilisateur
 *  (le tap du bouton). Ailleurs (Android/desktop) : accordé d'office. */
async function requestGyroPermission(): Promise<boolean> {
  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (DOE && typeof DOE.requestPermission === 'function') {
    try { return (await DOE.requestPermission()) === 'granted'; }
    catch { return false; }
  }
  return true;
}

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
 * Extension = icône officielle du repo intuition-box/Extension (assets/icon.png, logo Intuition).
 */
const portfolioItems: NavItem[] = [
  { Icon: ProjectsIcon, key: 'profil', point: 'B', img: `${ASSET}images/profile.jpg`, imgPosition: 'center' },
  { Icon: ContactIcon, key: 'overmind3d', point: 'C', img: `${ASSET}images/overmind3d.png`, imgPosition: '50% 47%', imgScale: 2.15 },
  { Icon: AboutIcon, key: 'ofc', point: 'D', img: `${ASSET}images/ofc.webp`, imgPosition: '50% 32%' },
  { Icon: HomeIcon, key: 'chromeExtension', point: 'E', img: `${ASSET}images/intuition-extension.png`, imgPosition: 'center' },
  // Couleur AVANT langue (échange 2026-07-22, retour Paul) : le dernier bouton de l'arc est au
  // ras du bord bas → le slider s'y déployait en zone de gestes système iOS (drag horizontal
  // près du bord = changer d'app). Un cran plus haut (~90px), il se déploie sur place sans souci.
  { Icon: null, key: 'color', action: 'color' },
  { Icon: LanguageIcon, key: 'language', action: 'language' },
  // Gyroscope « regarder autour » — MOBILE uniquement (filtré hors pointeur grossier). Toggle :
  // active/désactive l'effet d'inclinaison de l'appareil (borné, neutralisé en trajet/lecture).
  { Icon: GyroIcon, key: 'gyro', action: 'gyro' },
];

const NavArc = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bloomColor, setBloomColor] = useState(() =>
    localStorage.getItem(BLOOM_COLOR_KEY) || DEFAULT_BLOOM_COLOR
  );
  const [colorSliderOpen, setColorSliderOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Micro pop-up de confirmation au changement de langue (« Français » / « English »),
  // au-dessus du bouton langue, auto-effacé — feedback immédiat du choix (retour Paul mobile).
  const [langToast, setLangToast] = useState<string | null>(null);
  const langToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gyroscope (mobile) : état du toggle. OFF à chaque visite (gadget, décision Paul — pas persisté).
  const [gyroOn, setGyroOn] = useState(false);
  // État tuto (PR D) piloté par l'OnboardingBridge (event overmind:onboarding) :
  //  revealed → NavArc affichée (étape navarc atteinte, ou tuto terminé) ; sinon cachée.
  //  appearing → PILE à l'étape navarc → anim d'apparition + pulse du bouton langue.
  //  locked → tuto en cours → destinations grisées, seul le bouton langue actif.
  // gyroUnlocked (PR F1) : à l'étape « regarder autour » mobile, le bouton gyro devient actif (comme la
  // langue) pour que l'utilisateur active le gyroscope depuis l'arc, sinon il reste grisé avec les autres.
  const [navTuto, setNavTuto] = useState(() => {
    // Init hors tuto : tuto déjà terminé (persistance) → NavArc normale ; sinon cachée jusqu'à
    // ce que l'event la révèle (à l'étape navarc). Robuste si localStorage indispo / JSON cassé.
    try {
      const raw = localStorage.getItem('overmind-onboarding');
      const done = raw ? !!JSON.parse(raw).done : false;
      return { revealed: done, appearing: false, locked: false, gyroUnlocked: false };
    } catch { return { revealed: false, appearing: false, locked: false, gyroUnlocked: false }; }
  });
  // Items de l'arc : le bouton gyro n'existe que sur pointeur grossier (mobile/tablette).
  const navItems = useMemo(
    () => (isCoarsePointer() ? portfolioItems : portfolioItems.filter(i => i.action !== 'gyro')),
    [],
  );

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
      const newIndex = navItems.findIndex(item => item.point === point);
      setActiveIndex(prev => (newIndex !== -1 && newIndex !== prev ? newIndex : prev));
    };
    window.addEventListener('overmind:scroll-gauge-update', handler);
    return () => window.removeEventListener('overmind:scroll-gauge-update', handler);
  }, []);

  // État tuto (PR D) : l'OnboardingBridge diffuse { revealed, appearing, locked } dans l'event.
  useEffect(() => {
    const handler = (e: Event) => {
      const nav = (e as CustomEvent<{ nav?: { revealed: boolean; appearing: boolean; locked: boolean; gyroUnlocked: boolean } }>).detail?.nav;
      if (nav) setNavTuto(nav);
    };
    window.addEventListener('overmind:onboarding', handler);
    return () => window.removeEventListener('overmind:onboarding', handler);
  }, []);

  // Signale l'état ouvert/fermé de l'arc → la bulle du tuto affiche l'indication « fermer » au bon
  // moment (dans la pop-up, pas sur la NavArc pour ne pas l'encombrer — retour Paul).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('overmind:navarc-open', { detail: { open: isOpen } }));
  }, [isOpen]);


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

  const centralItem = navItems[activeIndex];

  const getSecondaryItems = () => {
    return navItems.filter((_, idx) => idx !== activeIndex);
  };

  const onHoverEnter = () => setIsOpen(true);
  const onHoverLeave = () => {
    if (!colorSliderOpen) setIsOpen(false);
  };

  // Tactile : un doigt ne « survole » pas → mouseleave n'arrive jamais proprement.
  // Le bouton central devient un TOGGLE au doigt (tap = ouvre/ferme) ; desktop inchangé
  // (le hover a déjà ouvert, le clic souris ne doit pas refermer sous le curseur).
  const onCentralClick = () => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      setIsOpen(prev => !prev);
      if (isOpen) setColorSliderOpen(false);
    }
  };

  // Standard des menus : un tap/clic EN DEHORS de l'arc ouvert le referme.
  // ⚠️ Le test se fait sur les éléments INTERACTIFS (boutons, slider), PAS sur le container :
  // .arc-menu-container est une bande invisible de 250px × toute la largeur (zone de tolérance
  // hover desktop) — sur un iPhone paysage elle couvre ~78% de l'écran, « dehors » n'existait
  // presque pas. Ici : tout tap hors bouton/slider ferme, même à 1px d'un bouton.
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('.arc-menu-button, .arc-color-slider')) {
        setIsOpen(false);
        setColorSliderOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [isOpen]);

  const handleClick = async (idx: number) => {
    try {
      const secondaryItems = getSecondaryItems();
      const clickedItem = secondaryItems[idx];

      // Bridage tuto : pendant la présentation, seul le bouton LANGUE est actif — PLUS le bouton GYRO
      // à l'étape « regarder autour » (gyroUnlocked). Le reste est ignoré (tooltip « … fin du tutoriel »).
      const tutoAllowed = clickedItem?.action === 'language'
        || (clickedItem?.action === 'gyro' && navTuto.gyroUnlocked);
      if (navTuto.locked && !tutoAllowed) return;

      if (clickedItem?.action === 'color') {
        setColorSliderOpen(prev => !prev);
        return;
      }

      if (clickedItem?.action === 'gyro') {
        const next = !gyroOn;
        // Activation : demander la permission (iOS) DANS ce geste. Refus → on n'active pas, mais on le
        // SIGNALE (le tuto rend alors l'étape « regarder autour » franchissable au swipe — secours).
        if (next && !(await requestGyroPermission())) {
          window.dispatchEvent(new CustomEvent('overmind:gyro-toggle', { detail: { enabled: false, denied: true } }));
          return;
        }
        setGyroOn(next);
        window.dispatchEvent(new CustomEvent('overmind:gyro-toggle', { detail: { enabled: next } }));
        return;
      }

      if (clickedItem?.action === 'language') {
        const newLang = i18n.language === 'en' ? 'fr' : 'en';
        i18n.changeLanguage(newLang);
        setLangToast(newLang === 'fr' ? 'Français' : 'English');
        if (langToastTimer.current) clearTimeout(langToastTimer.current);
        langToastTimer.current = setTimeout(() => setLangToast(null), 1600);
        return;
      }

      if (clickedItem?.point) {
        // Intention « aller à ce point ». Le moteur (SceneRenderer) choisit le mode : au repos →
        // trajet direct animé ; pendant un trajet / pas de clip direct → téléportation + CRT.
        window.dispatchEvent(new CustomEvent('overmind:nav-goto', { detail: clickedItem.point }));
      }
      setIsOpen(false);
    } catch (error) {
      console.warn('Navigation error:', error);
    }
  };

  const getButtonPosition = (idx: number, _total: number) => {
    // Ancrage vertical de l'arc : 5px du bord (30 → 20 → 0 → 5, retours Paul mobile).
    if (idx === -1) {
      return { left: "50%", bottom: "5px", transform: "translateX(-50%)" };
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
      bottom: `calc(5px + ${y}px)`,
      transform: "translateX(-50%)"
    };
  };

  if (typeof window === "undefined") return null;
  // Tuto (PR D) : NavArc cachée tant que le parcours n'a pas atteint l'étape navarc (1er passage).
  if (!navTuto.revealed) return null;

  const secondaryItems = getSecondaryItems();
  const colorBtnIndex = secondaryItems.findIndex(i => i.action === 'color');
  const colorBtnPos = colorBtnIndex !== -1 ? getButtonPosition(colorBtnIndex, secondaryItems.length) : null;
  const langBtnIndex = secondaryItems.findIndex(i => i.action === 'language');
  const langBtnPos = langBtnIndex !== -1 ? getButtonPosition(langBtnIndex, secondaryItems.length) : null;
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
      {/* Background assombri/flouté — DÉSACTIVÉ pendant le tuto (locked) : il masquerait le texte
          de la bulle d'onboarding derrière (retour Paul). Comportement normal hors tuto. */}
      {!navTuto.locked && <div className={`arc-background ${isOpen ? "is-open" : ""}`} />}

      <div
        ref={containerRef}
        className={`arc-menu-container ${isOpen ? "is-open" : ""} ${navTuto.appearing ? "arc-revealing" : ""}`}
        onMouseLeave={onHoverLeave}
      >
        <div className="arc-interaction-zone">
          {/* Bouton central */}
          <button
            className={`arc-menu-button central-button ${isOpen ? "is-open" : ""}`
              + `${navTuto.appearing && !isOpen ? " arc-central-pulse" : ""}`}
            style={getButtonPosition(-1, 1)}
            onMouseEnter={onHoverEnter}
            onClick={onCentralClick}
            title={label(centralItem)}
          >
            {renderIcon(centralItem, 32)}
          </button>

          {/* Boutons secondaires */}
          {secondaryItems.map((item, idx) => {
            // Le bouton Color est caché quand le slider est ouvert
            if (item.action === 'color' && colorSliderOpen) return null;

            const gyroActive = item.action === 'gyro' && gyroOn;
            const isLangBtn = item.action === 'language';
            const isGyroBtn = item.action === 'gyro';
            // Déverrouillés pendant le tuto : la langue TOUJOURS, le gyro à l'étape « regarder autour ».
            const tutoActive = isLangBtn || (isGyroBtn && navTuto.gyroUnlocked);
            const lockedBtn = navTuto.locked && !tutoActive; // grisé + clic ignoré pendant le tuto
            // Pulse d'appel : langue à l'étape navarc, gyro à l'étape « regarder autour » (tant qu'OFF).
            const pulseBtn = (isLangBtn && navTuto.appearing) || (isGyroBtn && navTuto.gyroUnlocked && !gyroOn);
            return (
              <button
                key={item.key}
                className={`arc-menu-button secondary-button ${isOpen ? "is-open" : ""}`
                  + `${lockedBtn ? " arc-locked" : ""}`
                  + `${pulseBtn ? " arc-lang-pulse" : ""}`}
                style={{
                  ...getButtonPosition(idx, secondaryItems.length),
                  // Gyro actif : halo cyan pour signaler l'état « on ».
                  ...(gyroActive ? { boxShadow: '0 0 14px 3px rgba(0, 229, 255, 0.75)' } : {}),
                }}
                onClick={() => handleClick(idx)}
                title={
                  lockedBtn ? t('navArc.lockedDuringTuto')
                  : item.action === 'language' ? languageTooltip
                  : item.action === 'gyro' ? t(gyroOn ? 'navArc.gyroDisable' : 'navArc.gyroEnable')
                  : label(item)
                }
              >
                {renderIcon(item, 32)}
              </button>
            );
          })}

          {/* Micro pop-up de confirmation de langue, au-dessus du bouton langue */}
          {langToast && langBtnPos && (
            <div
              className="arc-lang-toast"
              style={{
                left: langBtnPos.left,
                bottom: `calc(${langBtnPos.bottom} + 58px)`,
              }}
            >
              {langToast}
            </div>
          )}


          {/* Slider chromatique déployable — remplace le bouton Color quand ouvert (le bouton
              couleur est placé assez HAUT dans l'arc pour que le drag reste hors de la zone
              des gestes système iOS — cf. l'ordre de portfolioItems). */}
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

      {!navTuto.locked && <div className={`arc-overlay ${isOpen ? "is-open" : ""}`} />}
    </>,
    document.body
  );
};

export default NavArc;
