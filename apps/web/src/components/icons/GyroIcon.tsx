import React from 'react';
import { useTheme } from '../ThemeProvider';

interface GyroIconProps {
  size?: number;
  className?: string;
}

/** GyroIcon — « regarder autour » : appareil incliné + arcs de mouvement de part et d'autre. */
const GyroIcon: React.FC<GyroIconProps> = ({ size = 24, className = "" }) => {
  const { theme } = useTheme();
  const color = theme === 'dark' ? 'white' : 'black';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Appareil (rectangle arrondi) légèrement incliné */}
      <g transform="rotate(16 12 12)">
        <rect x="9" y="5" width="6" height="11" rx="1.4" stroke={color} strokeWidth="1.4" />
        <line x1="10.7" y1="13.7" x2="13.3" y2="13.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* Arcs de mouvement gauche/droite (on bouge l'appareil pour regarder autour) */}
      <path d="M5 18.2 A 7.5 7.5 0 0 1 4.7 10.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M19 18.2 A 7.5 7.5 0 0 0 19.3 10.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
};

export default GyroIcon;
