import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { FONT } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import type { Comment, DecisionMeta, NodeStyle } from "../../types/schema.ts";
import CommentBadge from "../overlays/CommentBadge.tsx";

export type DecisionNodeData = {
  label: string;
  sublabel: string | null;
  nodeStyle: NodeStyle;
  comments: Comment[];
  decisionMeta: DecisionMeta | null;
  shapeWidth: number;
  shapeHeight: number;
};

type DecisionNodeType = Node<DecisionNodeData, "decision">;

function DecisionNode({ data, selected }: NodeProps<DecisionNodeType>) {
  const { label, shapeWidth: W, shapeHeight: H, nodeStyle } = data;
  const width = W * 2;
  const height = H * 2;
  const themeColors = useThemeColors();
  const styleMap: Record<string, { fill: string; stroke: string; text: string }> = {
    default: themeColors.default,
    gray: themeColors.gray,
    orange: themeColors.orange,
    green: themeColors.green,
    "blue-ref": themeColors["blue-ref"],
    hypothesis: themeColors.hypothesis,
  };
  const colors = styleMap[nodeStyle] ?? themeColors.default;
  const isHypothesis = nodeStyle === "hypothesis";

  const lines = label.split("\n");
  const pad = 4;

  return (
    <div style={{ width, height, position: "relative" }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {selected && (
          <polygon
            points={`${W},${-pad} ${width + pad},${H} ${W},${height + pad} ${-pad},${H}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
          />
        )}
        <polygon
          points={`${W},0 ${width},${H} ${W},${height} 0,${H}`}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={1.5}
          strokeDasharray={isHypothesis ? "4,2" : undefined}
        />
        {lines.length === 1 ? (
          <text
            x={W}
            y={H}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FONT.nodeMain.size}
            fontWeight={FONT.nodeMain.weight}
            fill={colors.text}
          >
            {lines[0]}
          </text>
        ) : (
          lines.map((line, i) => (
            <text
              key={i}
              x={W}
              y={H + (i - (lines.length - 1) / 2) * (FONT.nodeMain.size * 1.25)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FONT.nodeMain.size}
              fontWeight={FONT.nodeMain.weight}
              fill={colors.text}
            >
              {line}
            </text>
          ))
        )}
      </svg>
      <CommentBadge comments={data.comments} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
}

export default memo(DecisionNode);
