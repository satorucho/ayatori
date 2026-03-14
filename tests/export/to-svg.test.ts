import { describe, it, expect } from "vitest";
import { exportToSVG } from "../../src/export/to-svg.ts";
import { calculateLayout, computeAllSizes } from "../../src/layout/engine.ts";
import { COLORS, LANE } from "../../src/layout/constants.ts";
import type { FlowChartSchema, FlowNode } from "../../src/types/schema.ts";

function getHalfSize(node: FlowNode, width: number, height: number) {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return { halfW: width, halfH: height };
  }
  return { halfW: width / 2, halfH: height / 2 };
}

describe("exportToSVG", () => {
  it("renders aligned lane headers and lane divider lines", async () => {
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
      .split("<!-- ====== Lane Headers ====== -->")[1] ?? "";

    const laneHeaderRegex = new RegExp(
      `<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="${LANE.headerHeight}"`,
      "g",
    );
    const yValues = [...laneSection.matchAll(laneHeaderRegex)].map((m) => Number(m[1]));

    expect(yValues.length).toBe(2);
    expect(yValues[1]).toBeCloseTo(yValues[0], 6);

    const minNodeCenterY = Math.min(...schema.nodes.map((node) => layout.positions[node.id].y));
    expect(yValues[0]).toBeCloseTo(minNodeCenterY - LANE.headerOffsetY, 6);

    const dividerMatches = [...svg.matchAll(
      new RegExp(
        `<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" stroke="${COLORS.divider}"[^>]*stroke-dasharray="8 4"`,
        "g",
      ),
    )];
    expect(dividerMatches.length).toBe(1);
    expect(Number(dividerMatches[0][2])).toBeCloseTo(minNodeCenterY - LANE.headerOffsetY, 6);
  });

  it("connects vertical arrows exactly at node boundaries", () => {
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

    const y1 = Number(lineMatch?.[2]);
    const y2 = Number(lineMatch?.[4]);
    const source = schema.nodes.find((n) => n.id === "s")!;
    const sourceSize = sizes.get("s")!;
    const { halfH: sourceHalfH } = getHalfSize(source, sourceSize.width, sourceSize.height);
    const sourceBottom = schema.layout!.positions.s.y + sourceHalfH;
    const target = schema.nodes.find((n) => n.id === "p")!;
    const targetSize = sizes.get("p")!;
    const { halfH } = getHalfSize(target, targetSize.width, targetSize.height);
    const targetTop = schema.layout!.positions.p.y - halfH;

    expect(y1).toBeCloseTo(sourceBottom, 6);
    expect(y2).toBeCloseTo(targetTop, 6);
  });

  it("connects horizontal arrows exactly at node boundaries", () => {
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

    const x1 = Number(lineMatch?.[1]);
    const x2 = Number(lineMatch?.[3]);
    const source = schema.nodes.find((n) => n.id === "d1")!;
    const sourceSize = sizes.get("d1")!;
    const { halfW: sourceHalfW } = getHalfSize(source, sourceSize.width, sourceSize.height);
    const sourceRight = schema.layout!.positions.d1.x + sourceHalfW;
    const target = schema.nodes.find((n) => n.id === "p1")!;
    const targetSize = sizes.get("p1")!;
    const { halfW } = getHalfSize(target, targetSize.width, targetSize.height);
    const targetLeft = schema.layout!.positions.p1.x - halfW;

    expect(x1).toBeCloseTo(sourceRight, 6);
    expect(x2).toBeCloseTo(targetLeft, 6);
  });

  it("renders phase headers above lane overlays and edges", async () => {
    const schema: FlowChartSchema = {
      schemaVersion: "1",
      meta: {
        name: "overlay-order",
        purpose: "test",
        granularity: "business",
        version: "2026-03-14",
      },
      lanes: [
        { id: "lane-a", label: "管理者", order: 0 },
        { id: "lane-b", label: "注文者", order: 1 },
      ],
      phases: [
        { id: "phase-a", label: "Phase A", order: 0 },
        { id: "phase-b", label: "Phase B", order: 1 },
      ],
      nodes: [
        { id: "n1", type: "start", label: "開始", sublabel: null, lane: "lane-a", phase: "phase-a", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
        { id: "n2", type: "process", label: "登録する", sublabel: null, lane: "lane-b", phase: "phase-a", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
        { id: "n3", type: "process", label: "確認する", sublabel: null, lane: "lane-a", phase: "phase-b", style: "default", comments: [], decisionMeta: null, referenceTargetId: null, timeLabel: null },
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

    const edgesIndex = svg.indexOf("<!-- ====== Edges ====== -->");
    const laneDividersIndex = svg.indexOf("<!-- ====== Lane Dividers ====== -->");
    const laneHeadersIndex = svg.indexOf("<!-- ====== Lane Headers ====== -->");
    const phaseHeadersIndex = svg.indexOf("<!-- ====== Phase Section Headers ====== -->");

    expect(edgesIndex).toBeGreaterThan(-1);
    expect(laneDividersIndex).toBeGreaterThan(edgesIndex);
    expect(laneHeadersIndex).toBeGreaterThan(laneDividersIndex);
    expect(phaseHeadersIndex).toBeGreaterThan(laneHeadersIndex);
  });
});
