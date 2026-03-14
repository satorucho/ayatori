import type {
  FlowChartSchema,
  FlowNode,
  FlowEdge,
  Lane,
  Phase,
  EdgeType,
  FlowLayout,
  NodePosition,
} from "../types/schema.ts";
import { getDefaultStyle } from "./defaults.ts";

/**
 * Sparse 表現の型。hydrate の逆変換で得られる。
 * デフォルト値と一致するフィールドは省略される。
 */
export interface SparseSchema {
  schemaVersion?: "1";
  meta: SparseSchema["meta"];
  lanes: SparseLane[];
  phases?: SparsePhase[];
  nodes: SparseNode[];
  edges: SparseEdge[];
  layout?: SparseLayout;
  designNotes?: string[];
  openQuestions?: string[];
}

type SparseLane = { id: string; label: string; order?: number };
type SparsePhase = { id: string; label: string; order?: number };

type SparseNode = {
  id: string;
  type: FlowNode["type"];
  label: string;
  sublabel?: string;
  lane: string;
  phase?: string;
  style?: FlowNode["style"];
  comments?: FlowNode["comments"];
  decisionMeta?: Partial<FlowNode["decisionMeta"] & object>;
  referenceTargetId?: string;
  timeLabel?: string;
};

type SparseEdge = {
  id: string;
  source: string;
  target: string;
  type?: FlowEdge["type"];
  label?: string | null;
  comments?: FlowEdge["comments"];
};

type SparseLayout = {
  positions: Record<string, NodePosition>;
  viewport: FlowLayout["viewport"];
};

const EDGE_TYPE_LABELS: Partial<Record<EdgeType, string>> = {
  yes: "Yes",
  no: "No",
};

/**
 * 完全な FlowChartSchema をデフォルト省略した sparse オブジェクトに変換する。
 * hydrate の逆操作。YAML やコンパクト JSON 出力に利用。
 */
export function dehydrateSchema(schema: FlowChartSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  result.meta = dehydrateMeta(schema.meta);

  result.lanes = schema.lanes.map((lane, i) => dehydrateLane(lane, i));

  if (schema.phases.length > 0) {
    result.phases = schema.phases.map((phase, i) => dehydratePhase(phase, i));
  }

  result.nodes = schema.nodes.map((node) => dehydrateNode(node));
  result.edges = schema.edges.map((edge) => dehydrateEdge(edge));

  if (schema.layout !== null) {
    result.layout = dehydrateLayout(schema.layout);
  }

  if (schema.designNotes.length > 0) {
    result.designNotes = schema.designNotes;
  }
  if (schema.openQuestions.length > 0) {
    result.openQuestions = schema.openQuestions;
  }

  return result;
}

function dehydrateMeta(meta: FlowChartSchema["meta"]): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: meta.name,
    purpose: meta.purpose,
    granularity: meta.granularity,
    version: meta.version,
  };
  if (meta.subtitle) {
    result.subtitle = meta.subtitle;
  }
  return result;
}

function dehydrateLane(lane: Lane, index: number): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: lane.id,
    label: lane.label,
  };
  if (lane.order !== index) {
    result.order = lane.order;
  }
  return result;
}

function dehydratePhase(phase: Phase, index: number): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: phase.id,
    label: phase.label,
  };
  if (phase.order !== index) {
    result.order = phase.order;
  }
  return result;
}

function dehydrateNode(node: FlowNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: node.id,
    type: node.type,
    label: node.label,
    lane: node.lane,
  };

  if (node.sublabel !== null) {
    result.sublabel = node.sublabel;
  }
  if (node.phase !== null) {
    result.phase = node.phase;
  }

  const defaultStyle = getDefaultStyle(node.type);
  if (node.style !== defaultStyle) {
    result.style = node.style;
  }

  if (node.comments.length > 0) {
    result.comments = node.comments;
  }

  if (node.decisionMeta !== null) {
    const dm = node.decisionMeta;
    const sparse: Record<string, unknown> = {};
    sparse.branchNumber = dm.branchNumber;
    if (dm.yesDirection !== "down") sparse.yesDirection = dm.yesDirection;
    if (dm.noDirection !== "right") sparse.noDirection = dm.noDirection;
    result.decisionMeta = sparse;
  }

  if (node.referenceTargetId !== null) {
    result.referenceTargetId = node.referenceTargetId;
  }
  if (node.timeLabel !== null) {
    result.timeLabel = node.timeLabel;
  }

  return result;
}

function dehydrateEdge(edge: FlowEdge): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
  };

  if (edge.type !== "normal") {
    result.type = edge.type;
  }

  const autoLabel = EDGE_TYPE_LABELS[edge.type] ?? null;
  if (edge.label !== autoLabel) {
    result.label = edge.label;
  }

  if (edge.comments.length > 0) {
    result.comments = edge.comments;
  }

  return result;
}

function dehydrateLayout(layout: FlowLayout): SparseLayout {
  return {
    positions: layout.positions,
    viewport: layout.viewport,
  };
}
