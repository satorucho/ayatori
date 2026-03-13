import { useMemo } from "react";
import { Panel } from "@xyflow/react";
import type { FlowChartSchema } from "../../types/schema.ts";
import type { ShapeSize } from "../../layout/sizing.ts";
import { COLORS, PHASE } from "../../layout/constants.ts";

interface PhaseOverlayProps {
  schema: FlowChartSchema;
  sizes: Map<string, ShapeSize>;
}

export default function PhaseOverlay({ schema }: PhaseOverlayProps) {
  const phases = useMemo(
    () => [...schema.phases].sort((a, b) => a.order - b.order),
    [schema.phases],
  );

  if (phases.length === 0) return null;

  return (
    <Panel position="top-left" style={{ top: 60 }}>
      <div className="flex flex-col gap-2 pointer-events-none">
        {phases.map((phase) => (
          <div
            key={phase.id}
            style={{
              width: PHASE.width,
              height: PHASE.height,
              background: COLORS.phase.fill,
              border: `1px solid ${COLORS.phase.stroke}`,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              paddingLeft: 15,
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.phase.text,
            }}
          >
            {phase.label}
          </div>
        ))}
      </div>
    </Panel>
  );
}
