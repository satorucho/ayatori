import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import type {
  FlowChartSchema,
  FlowLayout,
  FlowNode,
  NodePosition,
} from "../types/schema.ts";
import { measureNodeText, calculateShapeSize, unifyWidthsInColumn } from "./sizing.ts";
import type { ShapeSize } from "./sizing.ts";
import { SPACING, LANE } from "./constants.ts";
import type { LaneBoundary } from "./types.ts";

export interface LayoutOptions {
  force?: boolean;
}

const elk = new ELK();

function getElkNodeSize(
  node: FlowNode,
  sizes: Map<string, ShapeSize>,
): { width: number; height: number } {
  const size = sizes.get(node.id)!;
  if (node.type === "decision") {
    return { width: size.width * 2, height: size.height * 2 };
  }
  if (node.type === "start" || node.type === "end") {
    return { width: size.width * 2, height: size.height * 2 };
  }
  return { width: size.width, height: size.height };
}

export function computeAllSizes(
  schema: FlowChartSchema,
): Map<string, ShapeSize> {
  const sizes = new Map<string, ShapeSize>();
  const nodeTypes = new Map<string, FlowNode["type"]>();

  for (const node of schema.nodes) {
    const metrics = measureNodeText(node.label, node.sublabel, node.type);
    const isShort = isShortBranchNode(node.id, schema);
    const size = calculateShapeSize(metrics, node.type, isShort);
    sizes.set(node.id, size);
    nodeTypes.set(node.id, node.type);
  }

  // Group nodes by lane for width unification
  const laneNodes = new Map<string, string[]>();
  for (const node of schema.nodes) {
    if (!laneNodes.has(node.lane)) laneNodes.set(node.lane, []);
    laneNodes.get(node.lane)!.push(node.id);
  }
  for (const columnNodes of laneNodes.values()) {
    unifyWidthsInColumn(sizes, columnNodes, nodeTypes);
  }

  return sizes;
}

function isShortBranchNode(nodeId: string, schema: FlowChartSchema): boolean {
  const incomingNoEdge = schema.edges.find(
    (e) => e.target === nodeId && e.type === "no",
  );
  if (!incomingNoEdge) return false;

  const outgoingEdges = schema.edges.filter((e) => e.source === nodeId);
  return (
    outgoingEdges.length === 0 ||
    (outgoingEdges.length === 1 && outgoingEdges[0].type === "merge")
  );
}

export async function calculateLayout(
  schema: FlowChartSchema,
  options?: LayoutOptions,
): Promise<FlowLayout> {
  const sizes = computeAllSizes(schema);
  const laneOrder = new Map(schema.lanes.map((l) => [l.id, l.order]));

  const elkChildren: ElkNode[] = schema.nodes.map((node) => {
    const { width, height } = getElkNodeSize(node, sizes);
    const partition = laneOrder.get(node.lane) ?? 0;
    return {
      id: node.id,
      width,
      height,
      layoutOptions: {
        "elk.partitioning.partition": String(partition),
      },
    };
  });

  const elkEdges: ElkExtendedEdge[] = schema.edges
    .filter((e) => e.type !== "merge")
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

  const graph: ElkNode = {
    id: "root",
    children: elkChildren,
    edges: elkEdges,
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(SPACING.M_VERTICAL),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(SPACING.M_VERTICAL),
      "elk.spacing.edgeNode": "20",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "LINEAR_SEGMENTS",
      "elk.partitioning.activate": "true",
    },
  };

  const layoutResult = await elk.layout(graph);

  const positions: Record<string, NodePosition> = {};

  if (layoutResult.children) {
    for (const child of layoutResult.children) {
      const node = schema.nodes.find((n) => n.id === child.id);
      if (!node || child.x === undefined || child.y === undefined) continue;

      const { width, height } = getElkNodeSize(node, sizes);

      // Skip pinned nodes unless force mode
      if (
        !options?.force &&
        schema.layout?.positions[child.id]?.pinned
      ) {
        positions[child.id] = schema.layout.positions[child.id];
        continue;
      }

      positions[child.id] = {
        x: child.x + width / 2,
        y: child.y + height / 2,
      };
    }
  }

  alignNodesByLane(positions, schema, sizes);
  applyShortBranches(positions, schema, sizes);

  return {
    positions,
    viewport: schema.layout?.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

/**
 * Post-process: align nodes within each lane to a single CX per lane.
 * Follows style-guide §8-2:
 *   First lane CX = marginLeft + maxHalfWidth
 *   Next  lane CX = prevLaneMaxRight + gapBetweenLanes + maxHalfWidth
 *
 * Short-branch nodes are excluded (handled by applyShortBranches).
 */
function alignNodesByLane(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): void {
  const sortedLanes = [...schema.lanes].sort((a, b) => a.order - b.order);

  const shortBranchIds = new Set<string>();
  for (const edge of schema.edges) {
    if (edge.type === "no" && isShortBranchNode(edge.target, schema)) {
      shortBranchIds.add(edge.target);
    }
  }

  let prevMaxRight = 0;

  for (const lane of sortedLanes) {
    const laneNodeIds = schema.nodes
      .filter((n) => n.lane === lane.id && !shortBranchIds.has(n.id))
      .map((n) => n.id);

    if (laneNodeIds.length === 0) continue;

    let maxHalfWidth = 0;
    for (const nodeId of laneNodeIds) {
      const size = sizes.get(nodeId);
      const node = schema.nodes.find((n) => n.id === nodeId);
      if (!size || !node) continue;

      const halfW =
        node.type === "decision" || node.type === "start" || node.type === "end"
          ? size.width
          : size.width / 2;
      maxHalfWidth = Math.max(maxHalfWidth, halfW);
    }

    const cx =
      prevMaxRight === 0
        ? LANE.marginLeft + maxHalfWidth
        : prevMaxRight + LANE.gapBetweenLanes + maxHalfWidth;

    for (const nodeId of laneNodeIds) {
      if (positions[nodeId]) {
        positions[nodeId] = { ...positions[nodeId], x: cx };
      }
    }

    prevMaxRight = cx + maxHalfWidth;
  }
}

function applyShortBranches(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): void {
  for (const edge of schema.edges) {
    if (edge.type !== "no") continue;

    const targetNode = schema.nodes.find((n) => n.id === edge.target);
    if (!targetNode || !isShortBranchNode(edge.target, schema)) continue;

    const decisionPos = positions[edge.source];
    const decisionSize = sizes.get(edge.source);
    const targetSize = sizes.get(edge.target);
    if (!decisionPos || !decisionSize || !targetSize) continue;

    // 短い枝: decision右端 + 水平間隔 + ノード幅/2
    const decisionRightEdge =
      targetNode.type === "decision"
        ? decisionPos.x + decisionSize.width
        : decisionPos.x + decisionSize.width;

    positions[edge.target] = {
      x: decisionRightEdge + SPACING.M_HORIZONTAL + targetSize.width / 2,
      y: decisionPos.y,
    };
  }
}

export function calculateLaneDividers(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): LaneBoundary[] {
  const lanes = [...schema.lanes].sort((a, b) => a.order - b.order);
  const boundaries: LaneBoundary[] = [];

  for (const lane of lanes) {
    const laneNodeIds = schema.nodes
      .filter((n) => n.lane === lane.id)
      .map((n) => n.id);

    let minLeft = Infinity;
    let maxRight = -Infinity;

    for (const id of laneNodeIds) {
      const pos = positions[id];
      const size = sizes.get(id);
      const node = schema.nodes.find((n) => n.id === id);
      if (!pos || !size || !node) continue;

      let halfW: number;
      if (node.type === "decision" || node.type === "start" || node.type === "end") {
        halfW = size.width;
      } else {
        halfW = size.width / 2;
      }

      minLeft = Math.min(minLeft, pos.x - halfW);
      maxRight = Math.max(maxRight, pos.x + halfW);
    }

    if (minLeft === Infinity) {
      minLeft = 0;
      maxRight = 0;
    }

    boundaries.push({
      laneId: lane.id,
      minLeft,
      maxRight,
      dividerX: 0,
    });
  }

  for (let i = 0; i < boundaries.length - 1; i++) {
    boundaries[i].dividerX =
      (boundaries[i].maxRight + boundaries[i + 1].minLeft) / 2;
  }
  if (boundaries.length > 0) {
    boundaries[boundaries.length - 1].dividerX =
      boundaries[boundaries.length - 1].maxRight + LANE.marginRight;
  }

  return boundaries;
}
