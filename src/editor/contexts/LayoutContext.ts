import { createContext, useContext } from "react";
import type { PhaseBoundary } from "../../layout/types.ts";

interface LayoutContextValue {
  phaseBoundaries: PhaseBoundary[];
}

export const LayoutContext = createContext<LayoutContextValue>({
  phaseBoundaries: [],
});

export function useLayoutContext() {
  return useContext(LayoutContext);
}
