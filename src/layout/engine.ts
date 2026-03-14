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
import { SPACING, LANE, PHASE } from "./constants.ts";
import type { LaneBoundary, PhaseBoundary } from "./types.ts";

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

/** Get the half-height of a node for collision calculations */
function getNodeHalfHeight(node: FlowNode, size: ShapeSize): number {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return size.height; // size stores half-dimensions for these types
  }
  return size.height / 2;
}

/**
 * Topological sort using Kahn's algorithm.
 * Tie-breaking: nodes at the same level are ordered by their ELK-assigned Y position.
 */
function topologicalSort(
  schema: FlowChartSchema,
  positions: Record<string, NodePosition>,
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of schema.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of schema.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Start with nodes that have no incoming edges, sorted by Y
  const queue: string[] = [];
  for (const node of schema.nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
    }
  }
  queue.sort((a, b) => (positions[a]?.y ?? 0) - (positions[b]?.y ?? 0));

  const result: string[] = [];
  while (queue.length > 0) {
    // Sort by Y for deterministic ordering at each step
    queue.sort((a, b) => (positions[a]?.y ?? 0) - (positions[b]?.y ?? 0));
    const nodeId = queue.shift()!;
    result.push(nodeId);

    for (const target of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, newDegree);
      if (newDegree === 0) {
        queue.push(target);
      }
    }
  }

  // Add any remaining nodes (disconnected) not yet in result
  for (const node of schema.nodes) {
    if (!result.includes(node.id)) {
      result.push(node.id);
    }
  }

  return result;
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

  // Build ELK children WITHOUT partitioning – partitioning maps to horizontal
  // layers in DOWN mode which is wrong for vertical swimlanes.
  const elkChildren: ElkNode[] = schema.nodes.map((node) => {
    const { width, height } = getElkNodeSize(node, sizes);
    return {
      id: node.id,
      width,
      height,
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

  // Post-processing pipeline:
  // 1. Align X positions to lane centers
  alignNodesByLane(positions, schema, sizes);
  // 2. Resolve Y conflicts for nodes in the same lane at overlapping Y positions
  resolveYConflicts(positions, schema, sizes);
  // 3. Position short branch nodes beside their decision parent
  applyShortBranches(positions, schema, sizes);
  // 4. Insert vertical gaps between phases for section headers
  insertPhaseGaps(positions, schema, sizes);

  return {
    positions,
    viewport: schema.layout?.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

/**
 * Post-process: align nodes within each lane to a single CX per lane.
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

/**
 * Post-process: resolve Y-axis conflicts for nodes in the same lane.
 * When ELK places two nodes at the same layer (e.g. parallel branches),
 * and both belong to the same lane, they'd overlap after X alignment.
 *
 * We process nodes in topological order and ensure each node's Y position
 * respects:
 *   1. Its predecessors' bottom edges + spacing
 *   2. The previous same-lane node's bottom edge + spacing
 *
 * Short-branch nodes are excluded (handled by applyShortBranches).
 */
function resolveYConflicts(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): void {
  const shortBranchIds = new Set<string>();
  for (const edge of schema.edges) {
    if (edge.type === "no" && isShortBranchNode(edge.target, schema)) {
      shortBranchIds.add(edge.target);
    }
  }

  const nodeMap = new Map(schema.nodes.map((n) => [n.id, n]));
  const topoOrder = topologicalSort(schema, positions);

  // Track the maximum bottom Y for each lane
  const laneBottoms = new Map<string, number>();

  // Build predecessor map for edge constraints
  const predecessors = new Map<string, string[]>();
  for (const node of schema.nodes) {
    predecessors.set(node.id, []);
  }
  for (const edge of schema.edges) {
    predecessors.get(edge.target)?.push(edge.source);
  }

  for (const nodeId of topoOrder) {
    if (shortBranchIds.has(nodeId)) continue;

    const node = nodeMap.get(nodeId);
    const pos = positions[nodeId];
    const size = sizes.get(nodeId);
    if (!node || !pos || !size) continue;

    const halfH = getNodeHalfHeight(node, size);

    // Constraint 1: must be below all predecessors + spacing
    let minY = pos.y;
    for (const predId of predecessors.get(nodeId) ?? []) {
      if (shortBranchIds.has(predId)) continue;
      const predNode = nodeMap.get(predId);
      const predPos = positions[predId];
      const predSize = sizes.get(predId);
      if (!predNode || !predPos || !predSize) continue;

      const predHalfH = getNodeHalfHeight(predNode, predSize);
      const predBottom = predPos.y + predHalfH;
      const requiredY = predBottom + SPACING.M_VERTICAL + halfH;
      minY = Math.max(minY, requiredY);
    }

    // Constraint 2: must not overlap previous nodes in the same lane
    const laneBottom = laneBottoms.get(node.lane);
    if (laneBottom !== undefined) {
      const requiredY = laneBottom + SPACING.M_VERTICAL + halfH;
      minY = Math.max(minY, requiredY);
    }

    pos.y = minY;
    const newBottom = pos.y + halfH;
    laneBottoms.set(
      node.lane,
      Math.max(laneBottoms.get(node.lane) ?? -Infinity, newBottom),
    );
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
  const emptyIndices: number[] = [];

  for (let idx = 0; idx < lanes.length; idx++) {
    const lane = lanes[idx];
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
      emptyIndices.push(idx);
      boundaries.push({ laneId: lane.id, minLeft: NaN, maxRight: NaN, dividerX: 0 });
    } else {
      boundaries.push({ laneId: lane.id, minLeft, maxRight, dividerX: 0 });
    }
  }

  const DEFAULT_LANE_W = 200;
  for (const idx of emptyIndices) {
    let leftRef: LaneBoundary | null = null;
    for (let j = idx - 1; j >= 0; j--) {
      if (!isNaN(boundaries[j].minLeft)) { leftRef = boundaries[j]; break; }
    }
    let rightRef: LaneBoundary | null = null;
    for (let j = idx + 1; j < boundaries.length; j++) {
      if (!isNaN(boundaries[j].minLeft)) { rightRef = boundaries[j]; break; }
    }

    if (leftRef) {
      boundaries[idx].minLeft = leftRef.maxRight + LANE.gapBetweenLanes;
      boundaries[idx].maxRight = boundaries[idx].minLeft + DEFAULT_LANE_W;
    } else if (rightRef) {
      boundaries[idx].maxRight = rightRef.minLeft - LANE.gapBetweenLanes;
      boundaries[idx].minLeft = boundaries[idx].maxRight - DEFAULT_LANE_W;
    } else {
      boundaries[idx].minLeft = idx * (DEFAULT_LANE_W + LANE.gapBetweenLanes);
      boundaries[idx].maxRight = boundaries[idx].minLeft + DEFAULT_LANE_W;
    }
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

/**
 * Post-process: insert vertical gaps between phases to make room for
 * horizontal section header bands.  All nodes whose Y center is below a
 * phase boundary are pushed down by one header-height increment per
 * boundary they sit below.
 */
function insertPhaseGaps(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): void {
  const sortedPhases = [...schema.phases].sort((a, b) => a.order - b.order);
  if (sortedPhases.length <= 1) return;

  const boundaryYs: number[] = [];

  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const currentNodes = schema.nodes.filter(
      (n) => n.phase === sortedPhases[i].id,
    );
    const nextNodes = schema.nodes.filter(
      (n) => n.phase === sortedPhases[i + 1].id,
    );

    let maxBottom = -Infinity;
    let minTop = Infinity;

    for (const node of currentNodes) {
      const pos = positions[node.id];
      const size = sizes.get(node.id);
      if (!pos || !size) continue;
      maxBottom = Math.max(maxBottom, pos.y + getNodeHalfHeight(node, size));
    }

    for (const node of nextNodes) {
      const pos = positions[node.id];
      const size = sizes.get(node.id);
      if (!pos || !size) continue;
      minTop = Math.min(minTop, pos.y - getNodeHalfHeight(node, size));
    }

    if (maxBottom !== -Infinity && minTop !== Infinity) {
      boundaryYs.push((maxBottom + minTop) / 2);
    }
  }

  const gap = PHASE.headerHeight + PHASE.headerPaddingY * 2;

  for (const nodeId of Object.keys(positions)) {
    const pos = positions[nodeId];
    let shift = 0;
    for (const by of boundaryYs) {
      if (pos.y > by) shift += gap;
    }
    if (shift > 0) {
      positions[nodeId] = { ...positions[nodeId], y: pos.y + shift };
    }
  }
}

export function calculatePhaseDividers(
  positions: Record<string, NodePosition>,
  schema: FlowChartSchema,
  sizes: Map<string, ShapeSize>,
): PhaseBoundary[] {
  const sortedPhases = [...schema.phases].sort((a, b) => a.order - b.order);
  if (sortedPhases.length === 0) return [];

  const boundaries: PhaseBoundary[] = [];
  const emptyIndices: number[] = [];

  for (let idx = 0; idx < sortedPhases.length; idx++) {
    const phase = sortedPhases[idx];
    const phaseNodes = schema.nodes.filter((n) => n.phase === phase.id);
    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (const node of phaseNodes) {
      const pos = positions[node.id];
      const size = sizes.get(node.id);
      if (!pos || !size) continue;

      const halfH = getNodeHalfHeight(node, size);
      minTop = Math.min(minTop, pos.y - halfH);
      maxBottom = Math.max(maxBottom, pos.y + halfH);
    }

    if (minTop === Infinity) {
      emptyIndices.push(idx);
      boundaries.push({ phaseId: phase.id, label: phase.label, minTop: NaN, maxBottom: NaN, dividerY: 0 });
    } else {
      boundaries.push({ phaseId: phase.id, label: phase.label, minTop, maxBottom, dividerY: 0 });
    }
  }

  const DEFAULT_PHASE_H = 120;
  const PHASE_GAP = PHASE.headerHeight + PHASE.headerPaddingY * 2;
  for (const idx of emptyIndices) {
    let topRef: PhaseBoundary | null = null;
    for (let j = idx - 1; j >= 0; j--) {
      if (!isNaN(boundaries[j].minTop)) { topRef = boundaries[j]; break; }
    }
    let bottomRef: PhaseBoundary | null = null;
    for (let j = idx + 1; j < boundaries.length; j++) {
      if (!isNaN(boundaries[j].minTop)) { bottomRef = boundaries[j]; break; }
    }

    if (topRef) {
      boundaries[idx].minTop = topRef.maxBottom + PHASE_GAP;
      boundaries[idx].maxBottom = boundaries[idx].minTop + DEFAULT_PHASE_H;
    } else if (bottomRef) {
      boundaries[idx].maxBottom = bottomRef.minTop - PHASE_GAP;
      boundaries[idx].minTop = boundaries[idx].maxBottom - DEFAULT_PHASE_H;
    } else {
      boundaries[idx].minTop = idx * (DEFAULT_PHASE_H + PHASE_GAP);
      boundaries[idx].maxBottom = boundaries[idx].minTop + DEFAULT_PHASE_H;
    }
  }

  for (let i = 0; i < boundaries.length - 1; i++) {
    boundaries[i].dividerY =
      (boundaries[i].maxBottom + boundaries[i + 1].minTop) / 2;
  }
  if (boundaries.length > 0) {
    boundaries[boundaries.length - 1].dividerY =
      boundaries[boundaries.length - 1].maxBottom + LANE.marginBottom;
  }

  return boundaries;
}
