import { useState, useLayoutEffect, useCallback, type ReactNode } from "react";
import { ThemeContext, type Theme } from "./context.ts";

function applyThemeToDOM(theme: Theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("ayatori-theme");
      if (stored === "dark" || stored === "light") {
        applyThemeToDOM(stored);
        return stored;
      }
    } catch {
      /* ignore */
    }
    const t = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    applyThemeToDOM(t);
    return t;
  });

  useLayoutEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem("ayatori-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeRaw((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeRaw(t), []);

  return (
    <ThemeContext.Provider
      value={{ theme, isDark: theme === "dark", toggleTheme, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
