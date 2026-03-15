import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { FONT } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import type { NodeStyle, Comment } from "../../types/schema.ts";
import CommentBadge from "../overlays/CommentBadge.tsx";

export type StartEndNodeData = {
  label: string;
  sublabel: string | null;
  nodeStyle: NodeStyle;
  nodeType: "start" | "end";
  comments: Comment[];
  shapeWidth: number;
  shapeHeight: number;
};

type StartEndNodeType = Node<StartEndNodeData, "startEnd">;

function StartEndNode({ data, selected }: NodeProps<StartEndNodeType>) {
  const { label, sublabel, shapeWidth, shapeHeight, nodeType } = data;
  const rx = shapeWidth;
  const ry = shapeHeight;
  const width = rx * 2;
  const height = ry * 2;
  const themeColors = useThemeColors();
  const isStart = nodeType === "start";
  const isEnd = nodeType === "end";
  const colors = isStart ? themeColors.green : themeColors.startEnd;

  return (
    <div style={{ width, height, position: "relative" }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {selected && (
          <ellipse
            cx={rx}
            cy={ry}
            rx={rx + 3}
            ry={ry + 3}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
          />
        )}
        <ellipse
          cx={rx}
          cy={ry}
          rx={rx}
          ry={ry}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={1.5}
        />
        {isEnd && rx > 5 && ry > 5 && (
          <ellipse
            cx={rx}
            cy={ry}
            rx={rx - 3}
            ry={ry - 3}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={1}
          />
        )}
        {sublabel ? (
          <>
            <text
              x={rx}
              y={ry - 4}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FONT.nodeMain.size}
              fontWeight={FONT.nodeMain.weight}
              fill={colors.text}
            >
              {label}
            </text>
            <text
              x={rx}
              y={ry + FONT.nodeMain.size - 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FONT.nodeSub.size}
              fill={themeColors.sub.text}
            >
              {sublabel}
            </text>
          </>
        ) : (
          <text
            x={rx}
            y={ry}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FONT.nodeMain.size}
            fontWeight={FONT.nodeMain.weight}
            fill={colors.text}
          >
            {label}
          </text>
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

export default memo(StartEndNode);
