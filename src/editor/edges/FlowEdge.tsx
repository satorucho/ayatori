import { memo, useState, useRef, useEffect, useCallback } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";
import { FONT, PHASE } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import { useLayoutContext } from "../contexts/LayoutContext.ts";
import { useEditContext } from "../contexts/EditContext.ts";
import type { PhaseBoundary } from "../../layout/types.ts";
import type { EdgeType, Comment } from "../../types/schema.ts";

export type FlowEdgeData = {
  edgeType: EdgeType;
  edgeLabel: string | null;
  comments: Comment[];
};

type FlowEdgeType = Edge<FlowEdgeData, "flowEdge">;

const SELECTED_COLOR = "#3b82f6";
const HEADER_MARGIN = 10;

/**
 * Check if a Y coordinate overlaps any phase header band.
 * Returns an adjusted Y (above the header) if overlap, otherwise null.
 */
function avoidPhaseHeaders(
  midY: number,
  phaseBoundaries: PhaseBoundary[],
): number | null {
  for (const pb of phaseBoundaries) {
    const headerTop = pb.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
    const headerBottom = headerTop + PHASE.headerHeight;

    if (midY >= headerTop - HEADER_MARGIN && midY <= headerBottom + HEADER_MARGIN) {
      return headerTop - HEADER_MARGIN;
    }
  }
  return null;
}

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  selected,
}: EdgeProps<FlowEdgeType>) {
  const edgeType = data?.edgeType ?? "normal";
  const themeColors = useThemeColors();
  const { phaseBoundaries } = useLayoutContext();
  const { updateEdgeLabel } = useEditContext();

  const [editingLabel, setEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLabel) editRef.current?.focus();
  }, [editingLabel]);

  const commitLabelEdit = useCallback(() => {
    updateEdgeLabel(id, editValue.trim());
    setEditingLabel(false);
  }, [id, editValue, updateEdgeLabel]);

  const handleLabelDoubleClick = useCallback(() => {
    setEditValue(data?.edgeLabel ?? "");
    setEditingLabel(true);
  }, [data?.edgeLabel]);

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  const [defaultPath, defaultLabelX, defaultLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  edgePath = defaultPath;
  labelX = defaultLabelX;
  labelY = defaultLabelY;

  // For cross-lane edges (different X), check if the horizontal segment
  // overlaps with a phase header and reroute if so.
  if (Math.abs(sourceX - targetX) > 5 && phaseBoundaries.length > 0) {
    const naturalMidY = (sourceY + targetY) / 2;
    const adjustedY = avoidPhaseHeaders(naturalMidY, phaseBoundaries);

    if (adjustedY !== null) {
      edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${adjustedY} L ${targetX} ${adjustedY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = adjustedY;
    }
  }

  let strokeColor = themeColors.arrow.default;
  let strokeWidth = 1.2;
  let strokeDasharray: string | undefined;
  let markerEnd = "url(#arrow-default)";

  switch (edgeType) {
    case "normal":
    case "yes":
    case "no":
      strokeColor = themeColors.arrow.default;
      strokeWidth = 1.2;
      markerEnd = "url(#arrow-default)";
      break;
    case "loop":
      strokeColor = themeColors.arrow.loop;
      strokeWidth = 1;
      strokeDasharray = "4,2";
      markerEnd = "url(#arrow-loop)";
      break;
    case "hypothesis":
      strokeColor = themeColors.hypothesis.stroke;
      strokeWidth = 1;
      strokeDasharray = "4,2";
      markerEnd = "url(#arrow-default)";
      break;
    case "merge":
      strokeColor = themeColors.arrow.default;
      strokeWidth = 1;
      markerEnd = "";
      break;
  }

  if (selected) {
    strokeColor = SELECTED_COLOR;
    strokeWidth = Math.max(strokeWidth, 1.2) + 1;
    markerEnd = markerEnd ? "url(#arrow-selected)" : "";
  }

  return (
    <>
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={SELECTED_COLOR}
          strokeOpacity={0.2}
          strokeWidth={strokeWidth + 6}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
        markerEnd={markerEnd}
      />
      {(data?.edgeLabel || editingLabel) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: FONT.edgeLabel.size,
              color: selected ? SELECTED_COLOR : themeColors.sub.text,
              fontWeight: selected ? 700 : 400,
              pointerEvents: "all",
              background: themeColors.edgeLabelBg,
              padding: "1px 4px",
              borderRadius: 2,
              border: selected || editingLabel
                ? `1px solid ${editingLabel ? "#3b82f6" : SELECTED_COLOR}`
                : "none",
            }}
            className="nodrag nopan"
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleLabelDoubleClick();
            }}
          >
            {editingLabel ? (
              <input
                ref={editRef}
                className="bg-transparent outline-none text-center"
                style={{
                  fontSize: FONT.edgeLabel.size,
                  color: "inherit",
                  width: Math.max(40, editValue.length * 8 + 16),
                }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabelEdit();
                  if (e.key === "Escape") setEditingLabel(false);
                }}
                onBlur={commitLabelEdit}
              />
            ) : (
              data?.edgeLabel
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(FlowEdge);
