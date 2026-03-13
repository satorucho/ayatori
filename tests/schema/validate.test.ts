import { describe, it, expect } from "vitest";
import { validateSchema } from "../../src/schema/validate.ts";

const VALID_SCHEMA = {
  schemaVersion: "1",
  meta: {
    name: "テストフロー",
    purpose: "テストが完了するまで",
    granularity: "business",
    version: "2026-03-13",
  },
  lanes: [{ id: "lane-0", label: "担当者", order: 0 }],
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
    {
      id: "e1",
      source: "n1",
      target: "n2",
      type: "normal",
      label: null,
      comments: [],
    },
  ],
  layout: null,
  designNotes: [],
  openQuestions: [],
};

describe("validateSchema", () => {
  it("有効なスキーマが通る", () => {
    const result = validateSchema(VALID_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it("必須フィールドの欠落でエラー", () => {
    const result = validateSchema({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("存在しないレーンIDの参照でエラー", () => {
    const schema = {
      ...VALID_SCHEMA,
      nodes: VALID_SCHEMA.nodes.map((n) =>
        n.id === "n1" ? { ...n, lane: "nonexistent-lane" } : n,
      ),
    };
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("nonexistent-lane"))).toBe(true);
    }
  });

  it("存在しないノードIDへのエッジ参照でエラー", () => {
    const schema = {
      ...VALID_SCHEMA,
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "nonexistent-node",
          type: "normal",
          label: null,
          comments: [],
        },
      ],
    };
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.message.includes("nonexistent-node")),
      ).toBe(true);
    }
  });
});
