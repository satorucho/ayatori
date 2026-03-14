import { useContext } from "react";
import { ThemeContext } from "./context.ts";
import { COLORS, COLORS_DARK } from "../layout/constants.ts";

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  const { isDark } = useTheme();
  return isDark ? COLORS_DARK : COLORS;
}
