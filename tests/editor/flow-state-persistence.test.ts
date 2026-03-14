import { describe, expect, it } from "vitest";
import type { FlowChartSchema } from "../../src/types/schema.ts";
import { dehydrateSchema } from "../../src/schema/dehydrate.ts";
import { hydrateSchema } from "../../src/schema/hydrate.ts";
import { schemaToYaml, yamlToSchema } from "../../src/schema/yaml.ts";

const BASE_SCHEMA: FlowChartSchema = {
  schemaVersion: "1",
  meta: {
    name: "layout-persist-test",
    purpose: "テストが完了するまで",
    granularity: "business",
    version: "2026-03-14",
  },
  lanes: [{ id: "lane-0", label: "担当", order: 0 }],
  phases: [],
  nodes: [
    {
      id: "n1",
      type: "start",
      label: "開始",
      sublabel: null,
      lane: "lane-0",
      phase: null,
      style: "default",
      comments: [],
      decisionMeta: null,
      referenceTargetId: null,
      timeLabel: null,
    },
    {
      id: "n2",
      type: "process",
      label: "処理",
      sublabel: null,
      lane: "lane-0",
      phase: null,
      style: "default",
      comments: [],
      decisionMeta: null,
      referenceTargetId: null,
      timeLabel: null,
    },
    {
      id: "n3",
      type: "end",
      label: "完了",
      sublabel: null,
      lane: "lane-0",
      phase: null,
      style: "default",
      comments: [],
      decisionMeta: null,
      referenceTargetId: null,
      timeLabel: null,
    },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2", type: "normal", label: null, comments: [] },
    { id: "e2", source: "n2", target: "n3", type: "normal", label: null, comments: [] },
  ],
  layout: {
    positions: {
      n1: { x: 100, y: 120, pinned: true },
      n2: { x: 320, y: 220, pinned: true },
      n3: { x: 520, y: 320 },
    },
    viewport: {
      x: -16,
      y: 24,
      zoom: 0.9,
    },
  },
  designNotes: [],
  openQuestions: [],
};

describe("flow state persistence serialization", () => {
  it("dehydrate → hydrate で layout を保持する", () => {
    const sparse = dehydrateSchema(BASE_SCHEMA);
    const restored = hydrateSchema(sparse);
    expect(restored.layout).toEqual(BASE_SCHEMA.layout);
  });

  it("YAML roundtrip で layout を保持する", () => {
    const yaml = schemaToYaml(BASE_SCHEMA);
    const restored = yamlToSchema(yaml);
    expect(restored.layout).toEqual(BASE_SCHEMA.layout);
  });
});

