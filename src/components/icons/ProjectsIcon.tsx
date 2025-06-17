// src/components/icons/ProjectsIcon.tsx
import React from "react";
import { FileTextIcon } from "@radix-ui/react-icons";
import { useTheme } from "../ThemeProvider";

const ProjectsIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <FileTextIcon
      width={size}
      height={size}
      className={className}
      style={{
        color: isDark ? "white" : "black"
      }}
    />
  );
};

export default ProjectsIcon;