// src/components/icons/GitHubIcon.tsx
import React from "react";
import { useTheme } from "../ThemeProvider";

const GitHubIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => {
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
        d="M12 0.5C5.37 0.5 0 5.87 0 12.5C0 17.77 3.44 22.21 8.21 23.81C8.81 23.92 9.03 23.57 9.03 23.27C9.03 23 9.02 22.08 9.02 21.07C5.67 21.81 4.97 19.53 4.97 19.53C4.42 18.14 3.63 17.8 3.63 17.8C2.54 17.05 3.72 17.07 3.72 17.07C4.92 17.16 5.56 18.29 5.56 18.29C6.63 20.09 8.36 19.56 9.05 19.27C9.16 18.49 9.48 17.96 9.84 17.68C7.17 17.39 4.34 16.35 4.34 11.7C4.34 10.39 4.82 9.31 5.58 8.47C5.46 8.18 5.04 6.94 5.69 5.31C5.69 5.31 6.7 5 9.01 6.5C9.98 6.25 11.01 6.13 12.04 6.12C13.07 6.13 14.1 6.25 15.07 6.5C17.38 5 18.39 5.31 18.39 5.31C19.04 6.94 18.62 8.18 18.5 8.47C19.26 9.31 19.74 10.39 19.74 11.7C19.74 16.36 16.9 17.39 14.23 17.67C14.68 18.05 15.06 18.8 15.06 19.94C15.06 21.62 15.04 22.97 15.04 23.27C15.04 23.57 15.26 23.93 15.87 23.81C20.64 22.21 24.08 17.77 24.08 12.5C24.08 5.87 18.71 0.5 12.08 0.5H12Z"
        fill={isDark ? "white" : "black"}
      />
    </svg>
  );
};

export default GitHubIcon;