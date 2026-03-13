import { useMemo } from "react";
import { useStore } from "@xyflow/react";
import type { FlowChartSchema } from "../../types/schema.ts";
import type { LaneBoundary } from "../../layout/types.ts";
import { LANE, COLORS, FONT_FAMILY } from "../../layout/constants.ts";

interface LaneOverlayProps {
  schema: FlowChartSchema;
  laneBoundaries: LaneBoundary[];
}

export default function LaneOverlay({
  schema,
  laneBoundaries,
}: LaneOverlayProps) {
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  const lanes = useMemo(
    () => [...schema.lanes].sort((a, b) => a.order - b.order),
    [schema.lanes],
  );

  const minY = useMemo(() => {
    if (!schema.layout) return 0;
    const ys = Object.values(schema.layout.positions).map((p) => p.y);
    return ys.length > 0 ? Math.min(...ys) : 0;
  }, [schema.layout]);

  const maxY = useMemo(() => {
    if (!schema.layout) return 1000;
    const ys = Object.values(schema.layout.positions).map((p) => p.y);
    return ys.length > 0 ? Math.max(...ys) : 1000;
  }, [schema.layout]);

  if (lanes.length <= 1 || laneBoundaries.length === 0) return null;

  const [tx, ty, zoom] = transform;
  const headerY = minY - 80;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
        {laneBoundaries.map((boundary, i) => {
          if (i >= laneBoundaries.length - 1) return null;

          return (
            <line
              key={`divider-${boundary.laneId}`}
              x1={boundary.dividerX}
              y1={headerY}
              x2={boundary.dividerX}
              y2={maxY + 200}
              stroke="#ddd"
              strokeWidth={1 / zoom}
              strokeDasharray={`${8 / zoom} ${4 / zoom}`}
            />
          );
        })}

        {lanes.map((lane, i) => {
          const boundary = laneBoundaries.find((b) => b.laneId === lane.id);
          if (!boundary) return null;

          const leftEdge =
            i === 0
              ? boundary.minLeft - LANE.marginLeft
              : (laneBoundaries[i - 1]?.dividerX ?? boundary.minLeft);
          const rightEdge = boundary.dividerX;

          const headerLeft = leftEdge + LANE.headerInset;
          const headerWidth = rightEdge - leftEdge - LANE.headerInset * 2;

          if (headerWidth <= 0) return null;

          return (
            <g key={lane.id}>
              <rect
                x={headerLeft}
                y={headerY}
                width={headerWidth}
                height={LANE.headerHeight}
                rx={3}
                fill={COLORS.laneHeader.fill}
              />
              <text
                x={headerLeft + headerWidth / 2}
                y={headerY + LANE.headerHeight / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={COLORS.laneHeader.text}
                fontSize={20}
                fontWeight={700}
                fontFamily={FONT_FAMILY}
              >
                {lane.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
