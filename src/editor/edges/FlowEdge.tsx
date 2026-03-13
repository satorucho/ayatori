import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";
import { COLORS } from "../../layout/constants.ts";
import type { EdgeType, Comment } from "../../types/schema.ts";

export type FlowEdgeData = {
  edgeType: EdgeType;
  edgeLabel: string | null;
  comments: Comment[];
};

type FlowEdgeType = Edge<FlowEdgeData, "flowEdge">;

const SELECTED_COLOR = "#3b82f6";

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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  let strokeColor = COLORS.arrow.default;
  let strokeWidth = 1.2;
  let strokeDasharray: string | undefined;
  let markerEnd = "url(#arrow-default)";

  switch (edgeType) {
    case "normal":
    case "yes":
    case "no":
      strokeColor = COLORS.arrow.default;
      strokeWidth = 1.2;
      markerEnd = "url(#arrow-default)";
      break;
    case "loop":
      strokeColor = COLORS.arrow.loop;
      strokeWidth = 1;
      strokeDasharray = "4,2";
      markerEnd = "url(#arrow-loop)";
      break;
    case "hypothesis":
      strokeColor = "#aaa";
      strokeWidth = 1;
      strokeDasharray = "4,2";
      markerEnd = "url(#arrow-default)";
      break;
    case "merge":
      strokeColor = COLORS.arrow.default;
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
      {data?.edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              color: selected ? SELECTED_COLOR : "#999",
              fontWeight: selected ? 700 : 400,
              pointerEvents: "all",
              background: "white",
              padding: "1px 4px",
              borderRadius: 2,
              border: selected ? `1px solid ${SELECTED_COLOR}` : "none",
            }}
            className="nodrag nopan"
          >
            {data.edgeLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(FlowEdge);
