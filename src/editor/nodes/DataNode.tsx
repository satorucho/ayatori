import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { FONT } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import type { Comment } from "../../types/schema.ts";
import CommentBadge from "../overlays/CommentBadge.tsx";

export type DataNodeData = {
  label: string;
  sublabel: string | null;
  comments: Comment[];
  shapeWidth: number;
  shapeHeight: number;
};

type DataNodeType = Node<DataNodeData, "data">;

function DataNode({ data, selected }: NodeProps<DataNodeType>) {
  const { label, sublabel, shapeWidth, shapeHeight } = data;
  const themeColors = useThemeColors();
  const colors = themeColors.gray;

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
          fontSize: FONT.nodeMain.size,
          fontWeight: FONT.nodeMain.weight,
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
          style={{ fontSize: FONT.nodeSub.size, color: themeColors.sub.text, textAlign: "center", lineHeight: 1.5 }}
        >
          {sublabel}
        </div>
      )}
      <CommentBadge comments={data.comments} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
}

export default memo(DataNode);
