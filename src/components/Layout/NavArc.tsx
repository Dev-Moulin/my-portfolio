// src/components/layout/NavArc.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../ThemeProvider";
import { useTranslation } from 'react-i18next';
import LetterGlitch from "../animations/LetterGlitch";
import '../../styles/components/navArc.css';

// Icônes
import HomeIcon from "../icons/HomeIcon";
import ProjectsIcon from "../icons/ProjectsIcon";
import AboutIcon from "../icons/AboutIcon";
import ContactIcon from "../icons/ContactIcon";
import LanguageIcon from "../icons/LanguageIcon";
import ThemeIcon from "../icons/ThemeIcon";

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
  { Icon: ThemeIcon, label: "Theme", section: null }
];

const NavArc = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const [responsiveValues, setResponsiveValues] = useState(getResponsiveValues());

  useEffect(() => {
    const handleResize = () => {
      setResponsiveValues(getResponsiveValues());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Détecter la section active en fonction du scroll avec protection
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
        console.warn('Scroll handler error (possibly from browser extension):', error);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeIndex]);

  const centralItem = portfolioItems[activeIndex];

  const getSecondaryItems = () => {
    return portfolioItems.filter((_, idx) => idx !== activeIndex);
  };

  const onHoverEnter = () => {
    setIsOpen(true);
  };

  const onHoverLeave = () => {
    setIsOpen(false);
  };

  const handleClick = (idx: number) => {
    try {
      const secondaryItems = getSecondaryItems();
      const clickedItem = secondaryItems[idx];

      if (clickedItem?.label === "Theme") {
        setTheme(theme === "dark" ? "light" : "dark");
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
          element.scrollIntoView({ 
            behavior: "smooth",
            block: "start"
          });
        }
      }

      setIsOpen(false);
    } catch (error) {
      console.warn('Navigation error (possibly from browser extension):', error);
    }
  };

  const getButtonPosition = (idx: number, total: number) => {
    if (idx === -1) {
      return {
        left: "50%",
        bottom: "30px",
        transform: "translateX(-50%)"
      };
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

  return createPortal(
    <>
      {/* Background avec LetterGlitch */}
      <div className={`arc-background ${isOpen ? "is-open" : ""}`}>
       
      </div>

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
            {centralItem.label === "Contact" ? (
              <ContactIcon size={32} variant="primary" />
            ) : (
              <centralItem.Icon size={32} />
            )}
          </button>

          {/* Boutons secondaires */}
          {secondaryItems.map((item, idx) => (
            <button
              key={item.label}
              className={`arc-menu-button secondary-button ${isOpen ? "is-open" : ""}`}
              style={getButtonPosition(idx, secondaryItems.length)}
              onClick={() => handleClick(idx)}
              title={item.label === "Language" ? `Switch to ${i18n.language === 'en' ? 'French' : 'English'}` : item.label}
            >
              {item.label === "Contact" ? (
                <ContactIcon size={32} variant="secondary" />
              ) : (
                <item.Icon size={32} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`arc-overlay ${isOpen ? "is-open" : ""}`}></div>
    </>,
    document.body
  );
};

export default NavArc;