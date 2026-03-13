import { useCallback } from "react";
import type { FlowChartSchema } from "../../types/schema.ts";
import { calculateLayout } from "../../layout/engine.ts";

export function useAutoLayout() {
  const runLayout = useCallback(async (schema: FlowChartSchema) => {
    return await calculateLayout(schema);
  }, []);

  return { runLayout };
}
