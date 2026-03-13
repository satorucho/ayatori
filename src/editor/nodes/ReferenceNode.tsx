import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { COLORS } from "../../layout/constants.ts";
import type { Comment } from "../../types/schema.ts";

export type ReferenceNodeData = {
  label: string;
  sublabel: string | null;
  comments: Comment[];
  shapeWidth: number;
  shapeHeight: number;
};

type ReferenceNodeType = Node<ReferenceNodeData, "reference">;

function ReferenceNode({ data, selected }: NodeProps<ReferenceNodeType>) {
  const { label, sublabel, shapeWidth, shapeHeight } = data;
  const colors = COLORS["blue-ref"];

  return (
    <div
      style={{
        width: shapeWidth,
        height: shapeHeight,
        borderRadius: 3,
        border: `1.5px solid ${colors.stroke}`,
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
            color: colors.text,
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

export default memo(ReferenceNode);
