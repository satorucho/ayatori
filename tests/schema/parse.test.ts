import { describe, it, expect } from "vitest";
import { parseSchemaText } from "../../src/schema/parse.ts";

const VALID_JSON = JSON.stringify({
  schemaVersion: "1",
  meta: {
    name: "テスト",
    purpose: "テストが完了するまで",
    granularity: "business",
    version: "2026-03-14",
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
});

const VALID_YAML = `
meta:
  name: YAMLテスト
  purpose: テストが完了するまで
  granularity: business
  version: 2026-03-14
lanes:
  - id: lane-0
    label: 担当者
nodes:
  - id: n1
    type: start
    label: 開始
    lane: lane-0
  - id: n2
    type: end
    label: 完了
    lane: lane-0
edges:
  - id: e1
    source: n1
    target: n2
`;

describe("parseSchemaText", () => {
  it("有効なJSONを読み込める", () => {
    const result = parseSchemaText(VALID_JSON);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema.meta.name).toBe("テスト");
      expect(result.schema.nodes).toHaveLength(2);
    }
  });

  it("有効なYAMLを読み込める", () => {
    const result = parseSchemaText(VALID_YAML);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema.meta.name).toBe("YAMLテスト");
      expect(result.schema.edges).toHaveLength(1);
    }
  });

  it("空文字を拒否する", () => {
    const result = parseSchemaText("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("空");
    }
  });

  it("不正なJSONを拒否する", () => {
    const result = parseSchemaText("{ invalid json ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("解析");
    }
  });

  it("構造的に不正なスキーマを拒否する", () => {
    const invalid = `
meta:
  name: NG
  purpose: テストが完了するまで
  granularity: business
  version: 2026-03-14
nodes: []
edges: []
`;
    const result = parseSchemaText(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("スキーマ検証");
    }
  });

  it("未対応ノード種別を拒否する", () => {
    const invalidType = `
meta:
  name: NG
  purpose: テストが完了するまで
  granularity: business
  version: 2026-03-14
lanes:
  - id: lane-0
    label: 担当者
nodes:
  - id: n1
    type: start
    label: 開始
    lane: lane-0
  - id: n2
    type: manual
    label: 手作業
    lane: lane-0
edges:
  - id: e1
    source: n1
    target: n2
`;
    const result = parseSchemaText(invalidType);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("未対応");
    }
  });

  it("layout情報を含むJSONを保持する", () => {
    const withLayout = JSON.stringify({
      schemaVersion: "1",
      meta: {
        name: "レイアウト保持",
        purpose: "テストが完了するまで",
        granularity: "business",
        version: "2026-03-14",
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
      layout: {
        positions: {
          n1: { x: 100, y: 120, pinned: true },
          n2: { x: 280, y: 260 },
        },
        viewport: { x: -20, y: 15, zoom: 0.8 },
      },
      designNotes: [],
      openQuestions: [],
    });

    const result = parseSchemaText(withLayout);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema.layout).not.toBeNull();
      expect(result.schema.layout?.positions.n1).toEqual({
        x: 100,
        y: 120,
        pinned: true,
      });
      expect(result.schema.layout?.viewport).toEqual({
        x: -20,
        y: 15,
        zoom: 0.8,
      });
    }
  });
});

