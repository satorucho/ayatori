import type {
  FlowChartSchema,
  FlowNode,
  FlowEdge,
  Lane,
  Phase,
  FlowMeta,
  NodeType,
  NodeStyle,
} from "../types/schema.ts";
import { getDefaultStyle } from "../schema/defaults.ts";

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public context: string,
  ) {
    super(`Line ${line}: ${message}\n  Context: ${context}`);
    this.name = "ParseError";
  }
}

interface ParseState {
  meta: Partial<FlowMeta>;
  lanes: Lane[];
  phases: Phase[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  designNotes: string[];
  openQuestions: string[];
  nodeCounter: number;
  edgeCounter: number;
  lastNodeId: string | null;
  pendingArrow: boolean;
  currentSection: string;
  currentPhaseId: string | null;
}

function createNode(
  state: ParseState,
  type: NodeType,
  label: string,
  sublabel: string | null,
  laneId: string,
): string {
  state.nodeCounter++;
  const id = `n${state.nodeCounter}`;
  const style: NodeStyle = getDefaultStyle(type);

  const node: FlowNode = {
    id,
    type,
    label,
    sublabel,
    lane: laneId,
    phase: state.currentPhaseId,
    style,
    comments: [],
    decisionMeta: null,
    referenceTargetId: null,
    timeLabel: null,
  };

  state.nodes.push(node);
  return id;
}

function createEdge(
  state: ParseState,
  source: string,
  target: string,
  type: FlowEdge["type"],
  label: string | null,
): void {
  state.edgeCounter++;
  state.edges.push({
    id: `e${state.edgeCounter}`,
    source,
    target,
    type,
    label,
    comments: [],
  });
}

export function parseTextFlow(markdown: string): FlowChartSchema {
  const lines = markdown.split("\n");
  const state: ParseState = {
    meta: {
      granularity: "business",
      version: new Date().toISOString().split("T")[0],
    },
    lanes: [],
    phases: [],
    nodes: [],
    edges: [],
    designNotes: [],
    openQuestions: [],
    nodeCounter: 0,
    edgeCounter: 0,
    lastNodeId: null,
    pendingArrow: false,
    currentSection: "",
    currentPhaseId: null,
  };

  let branchCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Section headers
    if (line.startsWith("## ") || line.startsWith("# ")) {
      const heading = line.replace(/^#+\s*/, "");
      if (heading.includes("メタ情報")) {
        state.currentSection = "meta";
      } else if (heading.includes("フロー構造") || heading.includes("フロー")) {
        state.currentSection = "flow";
      } else if (heading.includes("設計判断")) {
        state.currentSection = "designNotes";
      } else if (heading.includes("要確認")) {
        state.currentSection = "openQuestions";
      }
      continue;
    }

    // Meta section
    if (state.currentSection === "meta") {
      const metaMatch = line.match(/^[-*]\s*(.+?)[:：]\s*(.+)/);
      if (metaMatch) {
        const key = metaMatch[1].trim();
        const value = metaMatch[2].trim();
        if (key.includes("フロー名") || key.includes("名称")) {
          state.meta.name = value;
        } else if (key.includes("目的")) {
          state.meta.purpose = value;
        } else if (key.includes("粒度")) {
          if (value.includes("経営")) state.meta.granularity = "executive";
          else if (value.includes("エンジニア"))
            state.meta.granularity = "engineer";
          else state.meta.granularity = "business";
        } else if (key.includes("レーン") || key.includes("アクター")) {
          const laneNames = value.split(/[/／、,]/);
          state.lanes = laneNames.map((name, idx) => ({
            id: `lane-${idx}`,
            label: name.trim(),
            order: idx,
          }));
        }
      }
      continue;
    }

    // Design notes section
    if (state.currentSection === "designNotes") {
      if (line.startsWith("-") || line.startsWith("*")) {
        state.designNotes.push(line.replace(/^[-*]\s*/, ""));
      }
      continue;
    }

    // Open questions section
    if (state.currentSection === "openQuestions") {
      if (line.startsWith("-") || line.startsWith("*") || line.match(/^[①-⑳]/)) {
        state.openQuestions.push(
          line.replace(/^[-*]\s*/, "").replace(/^[①-⑳]\s*/, ""),
        );
      }
      continue;
    }

    // Flow section
    if (state.currentSection === "flow") {
      const defaultLane =
        state.lanes.length > 0 ? state.lanes[0].id : "lane-0";

      // Phase header
      const phaseMatch = line.match(
        /^###\s*(Phase\s*[A-Z]|フェーズ\s*[A-Z])[：:]\s*(.+)/i,
      );
      if (phaseMatch) {
        const phaseLabel = line.replace(/^###\s*/, "");
        const phaseId = `phase-${state.phases.length}`;
        state.phases.push({
          id: phaseId,
          label: phaseLabel,
          order: state.phases.length,
        });
        state.currentPhaseId = phaseId;
        continue;
      }

      // Arrow down
      if (line === "↓") {
        state.pendingArrow = true;
        continue;
      }

      // Start node
      if (
        line.startsWith("開始") ||
        line.match(/^開始[（(]/) ||
        line.match(/^[（(].+[）)]$/) && !state.nodes.some((n) => n.type === "start")
      ) {
        const labelMatch = line.match(/[（(](.+?)[）)]/);
        const label = labelMatch ? labelMatch[1] : line.replace("開始", "開始");
        const nodeId = createNode(state, "start", label || "開始", null, defaultLane);

        if (state.pendingArrow && state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
          state.pendingArrow = false;
        }
        state.lastNodeId = nodeId;
        continue;
      }

      // End node
      if (line === "完了" || line === "終了" || line.startsWith("完了") || line.startsWith("終了")) {
        const label = line.length <= 4 ? line : line;
        const nodeId = createNode(state, "end", label, null, defaultLane);

        if (state.pendingArrow && state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
          state.pendingArrow = false;
        } else if (state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
        }
        state.lastNodeId = nodeId;
        continue;
      }

      // Decision node
      const decisionMatch = line.match(/^分岐([①-⑳\d]+)[：:]\s*(.+)/);
      if (decisionMatch) {
        branchCounter++;
        const label = decisionMatch[2];
        const nodeId = createNode(state, "decision", label, null, defaultLane);

        const node = state.nodes.find((n) => n.id === nodeId)!;
        node.decisionMeta = {
          branchNumber: branchCounter,
          yesDirection: "down",
          noDirection: "right",
        };

        if (state.pendingArrow && state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
          state.pendingArrow = false;
        } else if (state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
        }
        state.lastNodeId = nodeId;
        continue;
      }

      // Yes arrow
      if (line.startsWith("Yes") && (line.includes("↓") || line === "Yes")) {
        if (state.lastNodeId) {
          state.pendingArrow = true;
        }
        continue;
      }

      // No branch
      const noMatch = line.match(/^No\s*[→→]\s*(.+)/);
      if (noMatch) {
        const targetLabel = noMatch[1].trim();
        const decisionId = state.lastNodeId;

        if (decisionId) {
          let sublabel: string | null = null;
          const subMatch = targetLabel.match(/^(.+?)[（(](.+?)[）)]/);
          const mainLabel = subMatch ? subMatch[1].trim() : targetLabel;
          if (subMatch) sublabel = subMatch[2];

          const shortNodeId = createNode(
            state,
            "process",
            mainLabel,
            sublabel,
            defaultLane,
          );
          createEdge(state, decisionId, shortNodeId, "no", "No");
        }
        continue;
      }

      // Design note inline
      if (line.startsWith("※")) {
        state.designNotes.push(line.replace(/^※\s*/, ""));
        continue;
      }

      // Regular process node
      if (line.startsWith("-") || line.startsWith("*") || line.match(/^\d+\./)) {
        continue; // Skip list items that are not flow steps
      }

      // Sublabel detection
      let label = line;
      let sublabel: string | null = null;
      const subMatch = line.match(/^(.+?)[（(](.+?)[）)]\s*$/);
      if (subMatch) {
        label = subMatch[1].trim();
        sublabel = subMatch[2];
      }

      // Detect lane from bracket notation like 【管理者】
      let laneId = defaultLane;
      const laneMatch = label.match(/【(.+?)】/);
      if (laneMatch) {
        const laneName = laneMatch[1];
        const matchedLane = state.lanes.find((l) => l.label === laneName);
        if (matchedLane) {
          laneId = matchedLane.id;
        }
        label = label.replace(/【.+?】/, "").trim();
      }

      if (label) {
        const nodeId = createNode(state, "process", label, sublabel, laneId);

        if (state.pendingArrow && state.lastNodeId) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
          state.pendingArrow = false;
        } else if (state.lastNodeId && state.nodes.length > 1) {
          createEdge(state, state.lastNodeId, nodeId, "normal", null);
        }
        state.lastNodeId = nodeId;
      }
    }
  }

  // Ensure at least one lane
  if (state.lanes.length === 0) {
    state.lanes.push({ id: "lane-0", label: "担当者", order: 0 });
  }

  return {
    schemaVersion: "1",
    meta: {
      name: state.meta.name ?? "無題のフロー",
      purpose: state.meta.purpose ?? "",
      granularity: state.meta.granularity ?? "business",
      version: state.meta.version ?? new Date().toISOString().split("T")[0],
    },
    lanes: state.lanes,
    phases: state.phases,
    nodes: state.nodes,
    edges: state.edges,
    layout: null,
    designNotes: state.designNotes,
    openQuestions: state.openQuestions,
  };
}
