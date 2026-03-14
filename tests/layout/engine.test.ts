import { describe, it, expect } from "vitest";
import { calculateLayout, computeAllSizes } from "../../src/layout/engine.ts";
import type { FlowChartSchema } from "../../src/types/schema.ts";

const simpleFlow: FlowChartSchema = {
  schemaVersion: "1",
  meta: {
    name: "テスト",
    purpose: "テスト",
    granularity: "business",
    version: "2026-01-01",
  },
  lanes: [
    { id: "lane-a", label: "申請者", order: 0 },
    { id: "lane-b", label: "承認者", order: 1 },
  ],
  phases: [],
  nodes: [
    { id: "n1", type: "start", label: "開始", sublabel: null, lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "n2", type: "process", label: "申請書を作成する", sublabel: "申請システム", lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "n3", type: "decision", label: "内容に\n不備はないか", sublabel: null, lane: "lane-b", phase: null, style: "default", comments: [], decisionMeta: { branchNumber: 1, yesDirection: "down", noDirection: "right" }, referenceTargetId: null, timeLabel: null },
    { id: "n4", type: "process", label: "差し戻す", sublabel: null, lane: "lane-b", phase: null, style: "orange", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "n5", type: "process", label: "承認する", sublabel: "申請システム", lane: "lane-b", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "n6", type: "end", label: "完了", sublabel: null, lane: "lane-b", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2", type: "normal", label: null, comments: [] },
    { id: "e2", source: "n2", target: "n3", type: "normal", label: null, comments: [] },
    { id: "e3", source: "n3", target: "n4", type: "no", label: "No", comments: [] },
    { id: "e4", source: "n3", target: "n5", type: "yes", label: "Yes", comments: [] },
    { id: "e5", source: "n5", target: "n6", type: "normal", label: null, comments: [] },
  ],
  layout: null,
  designNotes: [],
  openQuestions: [],
};

describe("calculateLayout", () => {
  it("nodes in the same lane share the same center X", async () => {
    const layout = await calculateLayout(simpleFlow);

    // lane-applicant nodes (n1, n2) share CX
    expect(layout.positions["n2"].x).toBeCloseTo(
      layout.positions["n1"].x,
      1,
    );

    // lane-approver non-short-branch nodes (n3, n5, n6) share CX
    expect(layout.positions["n5"].x).toBeCloseTo(
      layout.positions["n3"].x,
      1,
    );
    expect(layout.positions["n6"].x).toBeCloseTo(
      layout.positions["n3"].x,
      1,
    );
  });

  it("different lanes have different CX values", async () => {
    const layout = await calculateLayout(simpleFlow);

    const laneApplicantX = layout.positions["n1"].x;
    const laneApproverX = layout.positions["n3"].x;

    expect(laneApproverX).toBeGreaterThan(laneApplicantX);
  });

  it("short branch node (n4) is positioned to the right of decision", async () => {
    const layout = await calculateLayout(simpleFlow);
    const decisionX = layout.positions["n3"].x;
    const branchX = layout.positions["n4"].x;

    expect(branchX).toBeGreaterThan(decisionX);
  });

  it("short branch node (n4) shares same Y as decision (n3)", async () => {
    const layout = await calculateLayout(simpleFlow);
    const decisionY = layout.positions["n3"].y;
    const branchY = layout.positions["n4"].y;

    expect(branchY).toBeCloseTo(decisionY, 1);
  });

  it("nodes are ordered top-to-bottom along the spine", async () => {
    const layout = await calculateLayout(simpleFlow);
    const spineIds = ["n1", "n2", "n3", "n5", "n6"];
    const ys = spineIds.map((id) => layout.positions[id].y);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
  });
});

const multiPhaseFlow: FlowChartSchema = {
  schemaVersion: "1",
  meta: { name: "multi-phase", purpose: "test", granularity: "business", version: "2026-01-01" },
  lanes: [
    { id: "lane-a", label: "Admin", order: 0 },
    { id: "lane-b", label: "User", order: 1 },
  ],
  phases: [
    { id: "ph1", label: "Phase 1", order: 0 },
    { id: "ph2", label: "Phase 2", order: 1 },
    { id: "ph3", label: "Phase 3", order: 2 },
  ],
  nodes: [
    { id: "s", type: "start", label: "開始", sublabel: null, lane: "lane-a", phase: "ph1", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "a1", type: "process", label: "A1", sublabel: null, lane: "lane-a", phase: "ph1", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b1", type: "process", label: "B1", sublabel: null, lane: "lane-a", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b2", type: "process", label: "B2", sublabel: null, lane: "lane-b", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b3", type: "process", label: "B3", sublabel: null, lane: "lane-a", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b4", type: "process", label: "B4", sublabel: null, lane: "lane-b", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b5", type: "process", label: "B5", sublabel: null, lane: "lane-b", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "b-end", type: "end", label: "B-End", sublabel: null, lane: "lane-b", phase: "ph2", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "c1", type: "process", label: "C1", sublabel: null, lane: "lane-a", phase: "ph3", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "c2", type: "process", label: "C2", sublabel: null, lane: "lane-a", phase: "ph3", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
    { id: "c3", type: "process", label: "C3", sublabel: null, lane: "lane-a", phase: "ph3", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
  ],
  edges: [
    { id: "e1", source: "s", target: "a1", type: "normal", label: null, comments: [] },
    { id: "e2", source: "a1", target: "b1", type: "normal", label: null, comments: [] },
    { id: "e3", source: "b1", target: "b2", type: "normal", label: null, comments: [] },
    { id: "e4", source: "b2", target: "b3", type: "normal", label: null, comments: [] },
    { id: "e5", source: "b3", target: "b4", type: "normal", label: null, comments: [] },
    { id: "e6", source: "b4", target: "b5", type: "normal", label: null, comments: [] },
    { id: "e7", source: "b5", target: "b-end", type: "normal", label: null, comments: [] },
    { id: "e8", source: "a1", target: "c1", type: "normal", label: null, comments: [] },
    { id: "e9", source: "c1", target: "c2", type: "normal", label: null, comments: [] },
    { id: "e10", source: "c2", target: "c3", type: "normal", label: null, comments: [] },
  ],
  layout: null,
  designNotes: [],
  openQuestions: [],
};

describe("calculateLayout – cross-phase same-lane gap", () => {
  it("same-lane nodes in a later phase have uniform vertical spacing", async () => {
    const layout = await calculateLayout(multiPhaseFlow);
    const sizes = computeAllSizes(multiPhaseFlow);

    function getHalfH(id: string) {
      const node = multiPhaseFlow.nodes.find((n) => n.id === id)!;
      const size = sizes.get(id)!;
      return node.type === "decision" || node.type === "start" || node.type === "end"
        ? size.height
        : size.height / 2;
    }

    const c1Bottom = layout.positions["c1"].y + getHalfH("c1");
    const c2Top = layout.positions["c2"].y - getHalfH("c2");
    const c2Bottom = layout.positions["c2"].y + getHalfH("c2");
    const c3Top = layout.positions["c3"].y - getHalfH("c3");

    const gap12 = c2Top - c1Bottom;
    const gap23 = c3Top - c2Bottom;

    expect(gap12).toBeCloseTo(gap23, 0);
  });

  it("phase 3 nodes are all below phase 2 nodes", async () => {
    const layout = await calculateLayout(multiPhaseFlow);
    const sizes = computeAllSizes(multiPhaseFlow);

    const ph2Nodes = multiPhaseFlow.nodes.filter((n) => n.phase === "ph2");
    const ph3Nodes = multiPhaseFlow.nodes.filter((n) => n.phase === "ph3");

    let maxPh2Bottom = -Infinity;
    for (const node of ph2Nodes) {
      const halfH =
        node.type === "decision" || node.type === "start" || node.type === "end"
          ? sizes.get(node.id)!.height
          : sizes.get(node.id)!.height / 2;
      maxPh2Bottom = Math.max(maxPh2Bottom, layout.positions[node.id].y + halfH);
    }

    for (const node of ph3Nodes) {
      const halfH =
        node.type === "decision" || node.type === "start" || node.type === "end"
          ? sizes.get(node.id)!.height
          : sizes.get(node.id)!.height / 2;
      const top = layout.positions[node.id].y - halfH;
      expect(top).toBeGreaterThan(maxPh2Bottom);
    }
  });
});
