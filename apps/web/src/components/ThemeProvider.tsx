// src/components/ThemeProvider.tsx — Dark mode uniquement
import React, { useEffect } from "react";

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return <>{children}</>;
}

// Backward-compatible hook — dark mode uniquement, utilisé par les icônes
export const useTheme = () => ({
  theme: "dark" as const,
  setTheme: (_t: "dark" | "light") => {},
});
