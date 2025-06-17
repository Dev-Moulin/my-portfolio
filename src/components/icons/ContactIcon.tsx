// src/components/icons/ContactIcon.tsx
import React from "react";
import { useTheme } from "../ThemeProvider";

interface ContactIconProps {
  className?: string;
  size?: number;
  variant?: "primary" | "secondary";
}

const ContactIcon = ({ className = "", size = 24, variant = "secondary" }: ContactIconProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const color = isDark ? "white" : "black";

  return variant === "primary" ? (
    // Icône Contact pour bouton principal (avec maison de courrier)
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 15 15" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M7.94721 0.164594C7.66569 0.0238299 7.33431 0.0238302 7.05279 0.164594L0.552786 3.41459C0.214002 3.58399 0 3.93025 0 4.30902V12C0 12.5523 0.447715 13 1 13H14C14.5523 13 15 12.5523 15 12V4.30902C15 3.93025 14.786 3.58399 14.4472 3.41459L7.94721 0.164594ZM13.5689 4.09349L7.5 1.05902L1.43105 4.09349L7.5 7.29136L13.5689 4.09349ZM1 4.88366V12H14V4.88366L7.70977 8.19813C7.57848 8.26731 7.42152 8.26731 7.29023 8.19813L1 4.88366Z" 
        fill={color} 
        fillRule="evenodd" 
        clipRule="evenodd"
      />
    </svg>
  ) : (
    // Icône Contact pour bouton secondaire (enveloppe simple)
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 15 15" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M1 2C0.447715 2 0 2.44772 0 3V12C0 12.5523 0.447715 13 1 13H14C14.5523 13 15 12.5523 15 12V3C15 2.44772 14.5523 2 14 2H1ZM1 3L14 3V3.92494C13.9174 3.92486 13.8338 3.94751 13.7589 3.99505L7.5 7.96703L1.24112 3.99505C1.16621 3.94751 1.0826 3.92486 1 3.92494V3ZM1 4.90797V12H14V4.90797L7.74112 8.87995C7.59394 8.97335 7.40606 8.97335 7.25888 8.87995L1 4.90797Z" 
        fill={color} 
        fillRule="evenodd" 
        clipRule="evenodd"
      />
    </svg>
  );
};

export default ContactIcon;