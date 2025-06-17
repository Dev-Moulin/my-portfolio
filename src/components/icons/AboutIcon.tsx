// src/components/icons/AboutIcon.tsx
import React from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useTheme } from "../ThemeProvider";

const AboutIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <InfoCircledIcon
      width={size}
      height={size}
      className={className}
      style={{
        color: isDark ? "white" : "black"
      }}
    />
  );
};

export default AboutIcon;