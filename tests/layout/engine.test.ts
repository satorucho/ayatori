import { describe, it, expect } from "vitest";
import { calculateLayout } from "../../src/layout/engine.ts";
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
