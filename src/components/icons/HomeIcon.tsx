// src/components/icons/HomeIcon.tsx
import React from "react";
import { HomeIcon as RadixHomeIcon } from "@radix-ui/react-icons";
import { useTheme } from "../ThemeProvider";

const HomeIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <RadixHomeIcon
      width={size}
      height={size}
      className={className}
      style={{
        color: isDark ? "white" : "black"
      }}
    />
  );
};

export default HomeIcon;