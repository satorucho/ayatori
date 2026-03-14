import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { FONT } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
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

function ProcessNode({ data, selected }: NodeProps<ProcessNodeType>) {
  const { label, sublabel, nodeStyle, shapeWidth, shapeHeight } = data;
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
          style={{
            fontSize: FONT.nodeSub.size,
            color: themeColors.sub.text,
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
