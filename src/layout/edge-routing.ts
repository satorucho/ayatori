/**
 * Shared edge routing logic used by both the React Flow editor and SVG export.
 * Determines handle positions (top/bottom/left/right) for source and target
 * nodes of each edge, and computes actual connection point coordinates.
 */
import type {
  FlowChartSchema,
  FlowLayout,
  FlowEdge,
  FlowNode,
  NodePosition,
} from "../types/schema.ts";
import type { ShapeSize } from "./sizing.ts";

export type HandlePosition = "top" | "bottom" | "left" | "right";

export interface HandlePair {
  sourceHandle: HandlePosition;
  targetHandle: HandlePosition;
}

export interface ConnectionPoint {
  x: number;
  y: number;
}

/**
 * Get the half-width and half-height of a node for edge connection calculations.
 * For decision/start/end nodes, size stores half-dimensions directly.
 * For rect nodes, size stores full dimensions.
 */
function getHalfSize(node: FlowNode, size: ShapeSize): { halfW: number; halfH: number } {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return { halfW: size.width, halfH: size.height };
  }
  return { halfW: size.width / 2, halfH: size.height / 2 };
}

/**
 * Determine source and target handle positions for an edge.
 * This replicates the logic previously in useFlowState.ts's resolveHandles,
 * extracted as a pure function for sharing with SVG export.
 */
export function resolveHandles(
  edge: FlowEdge,
  schema: FlowChartSchema,
  layout: FlowLayout,
): HandlePair {
  // "no" edges: always horizontal (decision right → target left)
  if (edge.type === "no") {
    return { sourceHandle: "right", targetHandle: "left" };
  }

  // "loop" edges: determine by position if available
  if (edge.type === "loop") {
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];
    if (srcPos && tgtPos) {
      if (tgtPos.y < srcPos.y) {
        return {
          sourceHandle: tgtPos.x > srcPos.x ? "right" : "left",
          targetHandle: tgtPos.x > srcPos.x ? "left" : "right",
        };
      }
    }
  }

  // For normal downward edges: check if the edge would pass through an
  // intermediate node in the same lane. If so, route to the right side
  // to avoid visual overlap / hidden edges.
  if (edge.type !== "loop") {
    const srcNode = schema.nodes.find((n) => n.id === edge.source);
    const tgtNode = schema.nodes.find((n) => n.id === edge.target);
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];

    if (srcNode && tgtNode && srcPos && tgtPos && srcNode.lane === tgtNode.lane) {
      const minY = Math.min(srcPos.y, tgtPos.y);
      const maxY = Math.max(srcPos.y, tgtPos.y);

      const hasIntermediate = schema.nodes.some((n) => {
        if (n.id === edge.source || n.id === edge.target) return false;
        if (n.lane !== srcNode.lane) return false;
        const pos = layout.positions[n.id];
        return pos !== undefined && pos.y > minY + 10 && pos.y < maxY - 10;
      });

      if (hasIntermediate) {
        // Route right to avoid crossing through intermediate nodes.
        return { sourceHandle: "right", targetHandle: "right" };
      }
    }
  }

  // normal / yes / merge / hypothesis: always vertical flow
  return { sourceHandle: "bottom", targetHandle: "top" };
}

/**
 * Compute the actual pixel coordinate of a handle on a node.
 */
export function getConnectionPoint(
  pos: NodePosition,
  node: FlowNode,
  size: ShapeSize,
  handle: HandlePosition,
): ConnectionPoint {
  const { halfW, halfH } = getHalfSize(node, size);

  switch (handle) {
    case "top":
      return { x: pos.x, y: pos.y - halfH };
    case "bottom":
      return { x: pos.x, y: pos.y + halfH };
    case "left":
      return { x: pos.x - halfW, y: pos.y };
    case "right":
      return { x: pos.x + halfW, y: pos.y };
  }
}
