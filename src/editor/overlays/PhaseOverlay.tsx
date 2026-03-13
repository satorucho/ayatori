import { useMemo } from "react";
import { useStore } from "@xyflow/react";
import type { FlowChartSchema } from "../../types/schema.ts";
import type { ShapeSize } from "../../layout/sizing.ts";
import { COLORS, PHASE, FONT_FAMILY, LANE } from "../../layout/constants.ts";

interface PhaseOverlayProps {
  schema: FlowChartSchema;
  sizes: Map<string, ShapeSize>;
}

/** Get the half-height of a node for bounding-box calculations. */
function getNodeHalfHeight(
  nodeType: string,
  size: ShapeSize,
): number {
  if (nodeType === "decision" || nodeType === "start" || nodeType === "end") {
    return size.height;
  }
  return size.height / 2;
}

const PHASE_PADDING_Y = 20;

export default function PhaseOverlay({ schema, sizes }: PhaseOverlayProps) {
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  const phases = useMemo(
    () => [...schema.phases].sort((a, b) => a.order - b.order),
    [schema.phases],
  );

  const phaseBounds = useMemo(() => {
    if (phases.length === 0 || !schema.layout) return [];

    return phases.map((phase) => {
      const phaseNodes = schema.nodes.filter((n) => n.phase === phase.id);
      if (phaseNodes.length === 0) return null;

      let minY = Infinity;
      let maxY = -Infinity;

      for (const node of phaseNodes) {
        const pos = schema.layout?.positions[node.id];
        const size = sizes.get(node.id);
        if (!pos || !size) continue;

        const halfH = getNodeHalfHeight(node.type, size);
        minY = Math.min(minY, pos.y - halfH);
        maxY = Math.max(maxY, pos.y + halfH);
      }

      if (minY === Infinity) return null;

      return {
        phaseId: phase.id,
        label: phase.label,
        top: minY - PHASE_PADDING_Y,
        bottom: maxY + PHASE_PADDING_Y,
      };
    }).filter(Boolean) as { phaseId: string; label: string; top: number; bottom: number }[];
  }, [phases, schema.nodes, schema.layout, sizes]);

  if (phases.length === 0 || phaseBounds.length === 0) return null;

  const [tx, ty, zoom] = transform;
  const phaseX = LANE.marginLeft;

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
        {phaseBounds.map((bounds) => {
          const rectHeight = bounds.bottom - bounds.top;

          return (
            <g key={bounds.phaseId}>
              <rect
                x={phaseX}
                y={bounds.top}
                width={PHASE.width}
                height={rectHeight}
                rx={3}
                fill={COLORS.phase.fill}
                stroke={COLORS.phase.stroke}
                strokeWidth={1}
              />
              <text
                x={phaseX + 15}
                y={bounds.top + rectHeight / 2}
                dominantBaseline="central"
                fill={COLORS.phase.text}
                fontSize={14}
                fontWeight={600}
                fontFamily={FONT_FAMILY}
              >
                {wrapPhaseLabel(bounds.label, PHASE.width - 30).map(
                  (line, i, arr) => (
                    <tspan
                      key={i}
                      x={phaseX + 15}
                      dy={i === 0 ? -(arr.length - 1) * 9 : 18}
                    >
                      {line}
                    </tspan>
                  ),
                )}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Simple line-wrapping for phase labels.
 * Breaks at punctuation marks (：, (, /, etc.) when the line would exceed maxWidth.
 */
function wrapPhaseLabel(label: string, maxWidthPx: number): string[] {
  // Rough character width estimate: ~9px per CJK char, ~6px per ASCII
  const estimateWidth = (s: string) => {
    let w = 0;
    for (const ch of s) {
      w += ch.charCodeAt(0) > 0x7f ? 9 : 6;
    }
    return w;
  };

  if (estimateWidth(label) <= maxWidthPx) return [label];

  // Try to break at common break points
  const breakChars = ["：", "（", "(", "/", "・"];
  let bestBreak = -1;
  const chars = [...label];

  for (let i = 1; i < chars.length; i++) {
    const left = chars.slice(0, i).join("");
    if (estimateWidth(left) > maxWidthPx) break;

    if (breakChars.includes(chars[i])) {
      bestBreak = i;
    } else if (breakChars.includes(chars[i - 1]) && chars[i - 1] !== "/") {
      bestBreak = i;
    }
  }

  if (bestBreak === -1) {
    // Break at the last position that fits
    for (let i = chars.length - 1; i > 0; i--) {
      if (estimateWidth(chars.slice(0, i).join("")) <= maxWidthPx) {
        bestBreak = i;
        break;
      }
    }
  }

  if (bestBreak <= 0) return [label];

  const line1 = chars.slice(0, bestBreak).join("");
  const line2 = chars.slice(bestBreak).join("");
  return [line1, line2];
}
