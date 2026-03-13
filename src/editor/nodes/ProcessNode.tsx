import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { COLORS } from "../../layout/constants.ts";
import type { NodeStyle, Comment } from "../../types/schema.ts";

export type ProcessNodeData = {
  label: string;
  sublabel: string | null;
  nodeStyle: NodeStyle;
  comments: Comment[];
  shapeWidth: number;
  shapeHeight: number;
};

type ProcessNodeType = Node<ProcessNodeData, "process">;

const STYLE_MAP: Record<
  string,
  { fill: string; stroke: string; text: string }
> = {
  default: COLORS.default,
  gray: COLORS.gray,
  orange: COLORS.orange,
  green: COLORS.green,
  "blue-ref": COLORS["blue-ref"],
  hypothesis: COLORS.hypothesis,
};

function ProcessNode({ data, selected }: NodeProps<ProcessNodeType>) {
  const { label, sublabel, nodeStyle, shapeWidth, shapeHeight } = data;
  const colors = STYLE_MAP[nodeStyle] ?? COLORS.default;
  const isHypothesis = nodeStyle === "hypothesis";

  return (
    <div
      style={{
        width: shapeWidth,
        height: shapeHeight,
        borderRadius: 3,
        border: `1.5px ${isHypothesis ? "dashed" : "solid"} ${colors.stroke}`,
        background: colors.fill,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: selected
          ? "0 0 0 2.5px #3b82f6"
          : undefined,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: colors.text,
          textAlign: "center",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: 12,
            color: "#999",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {sublabel}
        </div>
      )}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
}

export default memo(ProcessNode);
