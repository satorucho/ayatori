import type {
  FlowChartSchema,
  FlowNode,
  FlowEdge,
  Lane,
  Phase,
  FlowLayout,
  NodePosition,
  Viewport,
  NodeType,
  EdgeType,
  DecisionMeta,
  Comment,
} from "../types/schema.ts";
import { getDefaultStyle } from "./defaults.ts";

/**
 * Sparse (省略可能フィールドが欠けている) なオブジェクトを
 * 完全な FlowChartSchema に hydrate する。
 *
 * AI やユーザーが書いた省略 JSON / YAML パース結果を受け取り、
 * 欠損フィールドにデフォルト値を補完して返す。
 */
export function hydrateSchema(data: Record<string, unknown>): FlowChartSchema {
  const meta = hydrateMeta(data.meta as Record<string, unknown> | undefined);
  const lanes = hydrateLanes(data.lanes as unknown[] | undefined);
  const phases = hydratePhases(data.phases as unknown[] | undefined);
  const nodes = hydrateNodes(data.nodes as unknown[] | undefined);
  const edges = hydrateEdges(data.edges as unknown[] | undefined);

  return {
    schemaVersion: "1",
    meta,
    lanes,
    phases,
    nodes,
    edges,
    layout: hydrateLayout(data.layout),
    designNotes: Array.isArray(data.designNotes)
      ? (data.designNotes as string[])
      : [],
    openQuestions: Array.isArray(data.openQuestions)
      ? (data.openQuestions as string[])
      : [],
  };
}

function hydrateMeta(
  raw: Record<string, unknown> | undefined,
): FlowChartSchema["meta"] {
  if (!raw) {
    return {
      name: "Untitled",
      purpose: "",
      granularity: "business",
      version: new Date().toISOString().split("T")[0],
    };
  }
  return {
    name: typeof raw.name === "string" ? raw.name : "Untitled",
    purpose: typeof raw.purpose === "string" ? raw.purpose : "",
    granularity: isGranularity(raw.granularity) ? raw.granularity : "business",
    version:
      typeof raw.version === "string"
        ? raw.version
        : new Date().toISOString().split("T")[0],
    ...(typeof raw.subtitle === "string" ? { subtitle: raw.subtitle } : {}),
  };
}

function isGranularity(v: unknown): v is "executive" | "business" | "engineer" {
  return v === "executive" || v === "business" || v === "engineer";
}

function hydrateLanes(raw: unknown[] | undefined): Lane[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, index) => {
    const obj = item as Record<string, unknown>;
    return {
      id: typeof obj.id === "string" ? obj.id : `lane-${index}`,
      label: typeof obj.label === "string" ? obj.label : `Lane ${index}`,
      order: typeof obj.order === "number" ? obj.order : index,
    };
  });
}

function hydratePhases(raw: unknown[] | undefined): Phase[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, index) => {
    const obj = item as Record<string, unknown>;
    return {
      id: typeof obj.id === "string" ? obj.id : `phase-${index}`,
      label: typeof obj.label === "string" ? obj.label : `Phase ${index}`,
      order: typeof obj.order === "number" ? obj.order : index,
    };
  });
}

const VALID_NODE_TYPES: Set<string> = new Set([
  "start", "end", "process", "decision", "data", "manual", "reference",
]);

const VALID_EDGE_TYPES: Set<string> = new Set([
  "normal", "yes", "no", "loop", "hypothesis", "merge",
]);

function hydrateNodes(raw: unknown[] | undefined): FlowNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const obj = item as Record<string, unknown>;
    const nodeType: NodeType = VALID_NODE_TYPES.has(obj.type as string)
      ? (obj.type as NodeType)
      : "process";

    return {
      id: typeof obj.id === "string" ? obj.id : `n${index + 1}`,
      type: nodeType,
      label: typeof obj.label === "string" ? obj.label : "",
      sublabel: typeof obj.sublabel === "string" ? obj.sublabel : null,
      lane: typeof obj.lane === "string" ? obj.lane : "",
      phase: typeof obj.phase === "string" ? obj.phase : null,
      style: typeof obj.style === "string" ? (obj.style as FlowNode["style"]) : getDefaultStyle(nodeType),
      comments: hydrateComments(obj.comments),
      decisionMeta: hydrateDecisionMeta(obj.decisionMeta, nodeType),
      referenceTargetId:
        typeof obj.referenceTargetId === "string"
          ? obj.referenceTargetId
          : null,
      timeLabel: typeof obj.timeLabel === "string" ? obj.timeLabel : null,
    };
  });
}

function hydrateDecisionMeta(
  raw: unknown,
  nodeType: NodeType,
): DecisionMeta | null {
  if (nodeType !== "decision") return null;
  if (!raw || typeof raw !== "object") {
    return { branchNumber: 1, yesDirection: "down", noDirection: "right" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    branchNumber:
      typeof obj.branchNumber === "number" ? obj.branchNumber : 1,
    yesDirection:
      obj.yesDirection === "right" ? "right" : "down",
    noDirection:
      obj.noDirection === "down" ? "down" : "right",
  };
}

const EDGE_TYPE_LABELS: Partial<Record<EdgeType, string>> = {
  yes: "Yes",
  no: "No",
};

function hydrateEdges(raw: unknown[] | undefined): FlowEdge[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const obj = item as Record<string, unknown>;
    const edgeType: EdgeType = VALID_EDGE_TYPES.has(obj.type as string)
      ? (obj.type as EdgeType)
      : "normal";

    const autoLabel = EDGE_TYPE_LABELS[edgeType] ?? null;

    return {
      id: typeof obj.id === "string" ? obj.id : `e${index + 1}`,
      source: typeof obj.source === "string" ? obj.source : "",
      target: typeof obj.target === "string" ? obj.target : "",
      type: edgeType,
      label:
        obj.label === undefined ? autoLabel : (obj.label as string | null),
      comments: hydrateComments(obj.comments),
    };
  });
}

function hydrateComments(raw: unknown): Comment[] {
  if (!Array.isArray(raw)) return [];
  return raw as Comment[];
}

function hydrateLayout(raw: unknown): FlowLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const positions = hydratePositions(obj.positions);
  if (!positions) return null;

  const viewport = hydrateViewport(obj.viewport);
  return {
    positions,
    viewport,
  };
}

function hydratePositions(raw: unknown): Record<string, NodePosition> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  const positions: Record<string, NodePosition> = {};

  for (const [nodeId, value] of entries) {
    if (!value || typeof value !== "object") continue;
    const pos = value as Record<string, unknown>;
    if (typeof pos.x !== "number" || typeof pos.y !== "number") continue;
    positions[nodeId] = {
      x: pos.x,
      y: pos.y,
      ...(typeof pos.pinned === "boolean" ? { pinned: pos.pinned } : {}),
    };
  }

  return Object.keys(positions).length > 0 ? positions : null;
}

function hydrateViewport(raw: unknown): Viewport {
  if (!raw || typeof raw !== "object") {
    return { x: 0, y: 0, zoom: 1 };
  }
  const viewport = raw as Record<string, unknown>;
  return {
    x: typeof viewport.x === "number" ? viewport.x : 0,
    y: typeof viewport.y === "number" ? viewport.y : 0,
    zoom: typeof viewport.zoom === "number" ? viewport.zoom : 1,
  };
}
