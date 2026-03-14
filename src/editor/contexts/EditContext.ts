import { createContext, useContext } from "react";

interface EditContextValue {
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
}

export const EditContext = createContext<EditContextValue>({
  updateNodeLabel: () => {},
  updateEdgeLabel: () => {},
});

export function useEditContext() {
  return useContext(EditContext);
}
