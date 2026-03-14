import { describe, it, expect } from "vitest";
import { exportToSVG } from "../../src/export/to-svg.ts";
import { calculateLayout, computeAllSizes } from "../../src/layout/engine.ts";
import { ARROW_GAP, LANE } from "../../src/layout/constants.ts";
import type { FlowChartSchema, FlowNode } from "../../src/types/schema.ts";

function getHalfSize(node: FlowNode, width: number, height: number) {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return { halfW: width, halfH: height };
  }
  return { halfW: width / 2, halfH: height / 2 };
}

describe("exportToSVG", () => {
  it("renders all lane headers on the same Y and uses configured header offset", async () => {
    const schema: FlowChartSchema = {
      schemaVersion: "1",
      meta: {
        name: "lane-header-test",
        purpose: "test",
        granularity: "business",
        version: "2026-03-14",
      },
      lanes: [
        { id: "lane-a", label: "管理者", order: 0 },
        { id: "lane-b", label: "注文者", order: 1 },
      ],
      phases: [],
      nodes: [
        { id: "n1", type: "start", label: "開始", sublabel: null, lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
        { id: "n2", type: "process", label: "処理する", sublabel: null, lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
        { id: "n3", type: "process", label: "確認する", sublabel: null, lane: "lane-b", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", type: "normal", label: null, comments: [] },
        { id: "e2", source: "n2", target: "n3", type: "normal", label: null, comments: [] },
      ],
      layout: null,
      designNotes: [],
      openQuestions: [],
    };

    const layout = await calculateLayout(schema);
    const sizes = computeAllSizes(schema);
    const svg = exportToSVG({ ...schema, layout }, layout, sizes);

    const laneSection = svg
      .split("<!-- ====== Lane Headers ====== -->")[1]
      ?.split("<!-- ====== Nodes ====== -->")[0] ?? "";

    const laneHeaderRegex = new RegExp(
      `<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="${LANE.headerHeight}"`,
      "g",
    );
    const yValues = [...laneSection.matchAll(laneHeaderRegex)].map((m) => Number(m[1]));

    expect(yValues.length).toBe(2);
    expect(yValues[1]).toBeCloseTo(yValues[0], 6);

    let minNodeTop = Infinity;
    for (const node of schema.nodes) {
      const pos = layout.positions[node.id];
      const size = sizes.get(node.id);
      if (!pos || !size) continue;
      const { halfH } = getHalfSize(node, size.width, size.height);
      minNodeTop = Math.min(minNodeTop, pos.y - halfH);
    }

    expect(yValues[0]).toBeCloseTo(minNodeTop - LANE.headerOffsetY, 6);
  });

  it("applies correct end-gap for vertical bottom-to-top arrows", () => {
    const schema: FlowChartSchema = {
      schemaVersion: "1",
      meta: {
        name: "vertical-arrow-gap",
        purpose: "test",
        granularity: "business",
        version: "2026-03-14",
      },
      lanes: [{ id: "lane-a", label: "担当者", order: 0 }],
      phases: [],
      nodes: [
        { id: "s", type: "start", label: "開始", sublabel: null, lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
        { id: "p", type: "process", label: "処理する", sublabel: null, lane: "lane-a", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
      ],
      edges: [
        { id: "e1", source: "s", target: "p", type: "normal", label: null, comments: [] },
      ],
      layout: {
        positions: {
          s: { x: 120, y: 100 },
          p: { x: 120, y: 220 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      designNotes: [],
      openQuestions: [],
    };

    const sizes = computeAllSizes(schema);
    const svg = exportToSVG(schema, schema.layout!, sizes);
    const edgeSection = svg.split("<!-- ====== Edges ====== -->")[1] ?? "";

    const lineMatch = edgeSection.match(
      /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"[^>]*marker-end="url\(#a\)"/,
    );
    expect(lineMatch).not.toBeNull();

    const y2 = Number(lineMatch?.[4]);
    const target = schema.nodes.find((n) => n.id === "p")!;
    const targetSize = sizes.get("p")!;
    const { halfH } = getHalfSize(target, targetSize.width, targetSize.height);
    const targetTop = schema.layout!.positions.p.y - halfH;
    const expectedY2 = targetTop - (ARROW_GAP.end + ARROW_GAP.marker);

    expect(y2).toBeCloseTo(expectedY2, 6);
  });

  it("applies correct end-gap for horizontal right-to-left arrows", () => {
    const schema: FlowChartSchema = {
      schemaVersion: "1",
      meta: {
        name: "horizontal-arrow-gap",
        purpose: "test",
        granularity: "business",
        version: "2026-03-14",
      },
      lanes: [
        { id: "lane-a", label: "左", order: 0 },
        { id: "lane-b", label: "右", order: 1 },
      ],
      phases: [],
      nodes: [
        {
          id: "d1",
          type: "decision",
          label: "判断するか",
          sublabel: null,
          lane: "lane-a",
          phase: null,
          style: "default",
          comments: [],
          decisionMeta: { branchNumber: 1, yesDirection: "down", noDirection: "right" },
          referenceTargetId: null,
          timeLabel: null,
        },
        { id: "p1", type: "process", label: "再確認する", sublabel: null, lane: "lane-b", phase: null, style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
      ],
      edges: [
        { id: "e-no", source: "d1", target: "p1", type: "no", label: "No", comments: [] },
      ],
      layout: {
        positions: {
          d1: { x: 120, y: 120 },
          p1: { x: 380, y: 120 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      designNotes: [],
      openQuestions: [],
    };

    const sizes = computeAllSizes(schema);
    const svg = exportToSVG(schema, schema.layout!, sizes);
    const edgeSection = svg.split("<!-- ====== Edges ====== -->")[1] ?? "";

    const lineMatch = edgeSection.match(
      /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"[^>]*marker-end="url\(#a\)"/,
    );
    expect(lineMatch).not.toBeNull();

    const x2 = Number(lineMatch?.[3]);
    const target = schema.nodes.find((n) => n.id === "p1")!;
    const targetSize = sizes.get("p1")!;
    const { halfW } = getHalfSize(target, targetSize.width, targetSize.height);
    const targetLeft = schema.layout!.positions.p1.x - halfW;
    const expectedX2 = targetLeft - (ARROW_GAP.end + ARROW_GAP.marker);

    expect(x2).toBeCloseTo(expectedX2, 6);
  });
});
