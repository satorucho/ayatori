import type { NodeType, NodeStyle } from "../types/schema.ts";

const NODE_TYPE_TO_STYLE: Record<NodeType, NodeStyle> = {
  start: "default",
  end: "default",
  process: "default",
  decision: "default",
};

export function getDefaultStyle(nodeType: NodeType): NodeStyle {
  return NODE_TYPE_TO_STYLE[nodeType];
}
