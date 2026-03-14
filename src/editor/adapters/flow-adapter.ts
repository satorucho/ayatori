import type { Edge, Node } from "@xyflow/react";
import type { FlowChartSchema, FlowLayout, FlowNode } from "../../types/schema.ts";
import { resolveHandles } from "../../layout/edge-routing.ts";
import type { ShapeSize } from "../../layout/sizing.ts";

export function schemaNodeTypeToReactFlowType(type: FlowNode["type"]): string {
  if (type === "start" || type === "end") return "startEnd";
  return type;
}

function getRenderNodeSize(node: FlowNode, size?: ShapeSize): { width: number; height: number } {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return {
      width: (size?.width ?? 50) * 2,
      height: (size?.height ?? 50) * 2,
    };
  }
  return {
    width: size?.width ?? 200,
    height: size?.height ?? 40,
  };
}

export function schemaToReactFlowNodes(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): Node[] {
  return schema.nodes.map((node) => {
    const pos = layout.positions[node.id] ?? { x: 0, y: 0 };
    const size = sizes.get(node.id);
    const renderSize = getRenderNodeSize(node, size);

    return {
      id: node.id,
      type: schemaNodeTypeToReactFlowType(node.type),
      position: {
        x: pos.x - renderSize.width / 2,
        y: pos.y - renderSize.height / 2,
      },
      data: {
        label: node.label,
        sublabel: node.sublabel,
        nodeStyle: node.style,
        nodeType: node.type,
        comments: node.comments,
        decisionMeta: node.decisionMeta,
        shapeWidth: size?.width ?? 50,
        shapeHeight: size?.height ?? 50,
      },
    };
  });
}

function resolveHandlesForEditor(
  edge: FlowChartSchema["edges"][0],
  schema: FlowChartSchema,
  layout: FlowLayout | null,
): { sourceHandle: string; targetHandle: string } {
  if (!layout) {
    if (edge.type === "no") return { sourceHandle: "right", targetHandle: "left" };
    return { sourceHandle: "bottom", targetHandle: "top" };
  }
  return resolveHandles(edge, schema, layout);
}

export function schemaToReactFlowEdges(
  schema: FlowChartSchema,
  layout: FlowLayout | null = null,
): Edge[] {
  return schema.edges.map((edge) => {
    const { sourceHandle, targetHandle } = resolveHandlesForEditor(edge, schema, layout);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: "flowEdge",
      data: {
        edgeType: edge.type,
        edgeLabel: edge.label,
        comments: edge.comments,
      },
    };
  });
}

