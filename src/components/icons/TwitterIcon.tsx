// src/components/icons/TwitterIcon.tsx
import React from "react";
import { useTheme } from "../ThemeProvider";

const TwitterIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.084 4.126H5.117L17.083 19.77Z"
        fill={isDark ? "white" : "black"}
      />
    </svg>
  );
};

export default TwitterIcon;