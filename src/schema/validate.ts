import type { FlowChartSchema } from "../types/schema.ts";

export interface ValidationError {
  path: string;
  message: string;
}

export function validateSchema(
  data: unknown,
): { valid: true; schema: FlowChartSchema } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: [{ path: "", message: "データがオブジェクトではありません" }] };
  }

  const obj = data as Record<string, unknown>;

  // schemaVersion
  if (obj.schemaVersion !== "1") {
    errors.push({
      path: "schemaVersion",
      message: `schemaVersionは"1"である必要があります（受け取った値: ${String(obj.schemaVersion)})`,
    });
  }

  // meta
  if (!obj.meta || typeof obj.meta !== "object") {
    errors.push({ path: "meta", message: "metaオブジェクトが必要です" });
  } else {
    const meta = obj.meta as Record<string, unknown>;
    if (typeof meta.name !== "string" || !meta.name) {
      errors.push({ path: "meta.name", message: "フロー名称が必要です" });
    }
    if (typeof meta.purpose !== "string") {
      errors.push({ path: "meta.purpose", message: "目的が必要です" });
    }
    if (!["executive", "business", "engineer"].includes(meta.granularity as string)) {
      errors.push({
        path: "meta.granularity",
        message: 'granularityは "executive", "business", "engineer" のいずれかである必要があります',
      });
    }
    if (typeof meta.version !== "string") {
      errors.push({ path: "meta.version", message: "バージョンが必要です" });
    }
  }

  // lanes
  if (!Array.isArray(obj.lanes) || obj.lanes.length === 0) {
    errors.push({ path: "lanes", message: "レーンが1つ以上必要です" });
  }

  // nodes
  if (!Array.isArray(obj.nodes) || obj.nodes.length < 2) {
    errors.push({ path: "nodes", message: "ノードが2つ以上必要です（最低でも開始+終了）" });
  }

  // edges
  if (!Array.isArray(obj.edges) || obj.edges.length < 1) {
    errors.push({ path: "edges", message: "エッジが1つ以上必要です" });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const schema = data as FlowChartSchema;
  const laneIds = new Set(schema.lanes.map((l) => l.id));
  const nodeIds = new Set(schema.nodes.map((n) => n.id));
  const phaseIds = new Set(schema.phases.map((p) => p.id));

  // Validate node references
  for (const node of schema.nodes) {
    if (!laneIds.has(node.lane)) {
      errors.push({
        path: `nodes[${node.id}].lane`,
        message: `レーン "${node.lane}" が存在しません`,
      });
    }
    if (node.phase && !phaseIds.has(node.phase)) {
      errors.push({
        path: `nodes[${node.id}].phase`,
        message: `Phase "${node.phase}" が存在しません`,
      });
    }
  }

  // Validate edge references
  for (const edge of schema.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        path: `edges[${edge.id}].source`,
        message: `ソースノード "${edge.source}" が存在しません`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        path: `edges[${edge.id}].target`,
        message: `ターゲットノード "${edge.target}" が存在しません`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, schema };
}
