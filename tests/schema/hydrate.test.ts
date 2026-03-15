import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hydrateSchema } from "../../src/schema/hydrate.ts";
import { dehydrateSchema } from "../../src/schema/dehydrate.ts";
import { schemaToYaml, yamlToSchema } from "../../src/schema/yaml.ts";
import type { FlowChartSchema } from "../../src/types/schema.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

function loadSampleYaml(filename: string): FlowChartSchema {
  const path = resolve(currentDir, "../../public/sample-flows", filename);
  return yamlToSchema(readFileSync(path, "utf-8"));
}

describe("dehydrate → hydrate ラウンドトリップ", () => {
  it("simple-flow.yaml が dehydrate → hydrate で復元される", () => {
    const original = loadSampleYaml("simple-flow.yaml");
    const sparse = dehydrateSchema(original);
    const restored = hydrateSchema(sparse);
    expect(restored).toEqual(original);
  });

  it("asis-flow.yaml が dehydrate → hydrate で復元される", () => {
    const original = loadSampleYaml("asis-flow.yaml");
    const sparse = dehydrateSchema(original);
    const restored = hydrateSchema(sparse);
    expect(restored).toEqual(original);
  });
});

describe("dehydrate のトークン削減", () => {
  it("simple-flow.yaml の sparse 版は元より小さい", () => {
    const original = loadSampleYaml("simple-flow.yaml");
    const fullJson = JSON.stringify(original);
    const sparseJson = JSON.stringify(dehydrateSchema(original));
    expect(sparseJson.length).toBeLessThan(fullJson.length * 0.7);
  });

  it("asis-flow.yaml の sparse 版は元より小さい", () => {
    const original = loadSampleYaml("asis-flow.yaml");
    const fullJson = JSON.stringify(original);
    const sparseJson = JSON.stringify(dehydrateSchema(original));
    expect(sparseJson.length).toBeLessThan(fullJson.length * 0.7);
  });
});

describe("YAML ラウンドトリップ", () => {
  it("simple-flow.yaml → YAML → FlowChartSchema で復元される", () => {
    const original = loadSampleYaml("simple-flow.yaml");
    const yaml = schemaToYaml(original);
    const restored = yamlToSchema(yaml);
    expect(restored).toEqual(original);
  });

  it("asis-flow.yaml → YAML → FlowChartSchema で復元される", () => {
    const original = loadSampleYaml("asis-flow.yaml");
    const yaml = schemaToYaml(original);
    const restored = yamlToSchema(yaml);
    expect(restored).toEqual(original);
  });

  it("YAML は JSON.stringify より短い", () => {
    const original = loadSampleYaml("simple-flow.yaml");
    const fullJson = JSON.stringify(original, null, 2);
    const yaml = schemaToYaml(original);
    expect(yaml.length).toBeLessThan(fullJson.length * 0.7);
  });
});

describe("hydrate: 最小入力からのスキーマ生成", () => {
  it("ノード・エッジの省略フィールドにデフォルト値が入る", () => {
    const minimal = {
      meta: {
        name: "テスト",
        purpose: "テスト完了まで",
        granularity: "business",
        version: "2026-01-01",
      },
      lanes: [{ id: "lane-0", label: "担当" }],
      nodes: [
        { id: "n1", type: "start", label: "開始", lane: "lane-0" },
        { id: "n2", type: "end", label: "完了", lane: "lane-0" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
      ],
    };

    const schema = hydrateSchema(minimal);

    expect(schema.schemaVersion).toBe("1");
    expect(schema.phases).toEqual([]);
    expect(schema.layout).toBeNull();
    expect(schema.designNotes).toEqual([]);
    expect(schema.openQuestions).toEqual([]);

    const n1 = schema.nodes[0];
    expect(n1.sublabel).toBeNull();
    expect(n1.phase).toBeNull();
    expect(n1.style).toBe("default");
    expect(n1.comments).toEqual([]);
    expect(n1.decisionMeta).toBeNull();
    expect(n1.timeLabel).toBeNull();

    const e1 = schema.edges[0];
    expect(e1.type).toBe("normal");
    expect(e1.label).toBeNull();
    expect(e1.comments).toEqual([]);

    expect(schema.lanes[0].order).toBe(0);
  });

  it("decision ノードの decisionMeta にデフォルト値が入る", () => {
    const input = {
      meta: {
        name: "分岐テスト",
        purpose: "テスト",
        granularity: "business",
        version: "2026-01-01",
      },
      lanes: [{ id: "lane-0", label: "担当" }],
      nodes: [
        { id: "n1", type: "start", label: "開始", lane: "lane-0" },
        { id: "n2", type: "decision", label: "判断?", lane: "lane-0" },
        { id: "n3", type: "end", label: "完了", lane: "lane-0" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", type: "yes" },
      ],
    };

    const schema = hydrateSchema(input);
    const decision = schema.nodes.find((n) => n.type === "decision")!;
    expect(decision.decisionMeta).toEqual({
      branchNumber: 1,
      yesDirection: "down",
      noDirection: "right",
    });
  });

  it("start/process/decision/end ノードにデフォルトスタイルが適用される", () => {
    const input = {
      meta: { name: "t", purpose: "t", granularity: "business", version: "2026-01-01" },
      lanes: [{ id: "l", label: "l" }],
      nodes: [
        { id: "n1", type: "start", label: "s", lane: "l" },
        { id: "n2", type: "process", label: "p", lane: "l" },
        { id: "n3", type: "decision", label: "d?", lane: "l" },
        { id: "n5", type: "end", label: "e", lane: "l" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n5" },
      ],
    };

    const schema = hydrateSchema(input);
    expect(schema.nodes.find((n) => n.id === "n1")!.style).toBe("default");
    expect(schema.nodes.find((n) => n.id === "n2")!.style).toBe("default");
    expect(schema.nodes.find((n) => n.id === "n3")!.style).toBe("default");
    expect(schema.nodes.find((n) => n.id === "n5")!.style).toBe("default");
  });

  it("edge type=yes/no のラベルが自動補完される", () => {
    const input = {
      meta: { name: "t", purpose: "t", granularity: "business", version: "2026-01-01" },
      lanes: [{ id: "l", label: "l" }],
      nodes: [
        { id: "n1", type: "start", label: "s", lane: "l" },
        { id: "n2", type: "decision", label: "?", lane: "l" },
        { id: "n3", type: "end", label: "e", lane: "l" },
        { id: "n4", type: "end", label: "e2", lane: "l" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", type: "yes" },
        { id: "e3", source: "n2", target: "n4", type: "no" },
      ],
    };

    const schema = hydrateSchema(input);
    expect(schema.edges.find((e) => e.type === "yes")!.label).toBe("Yes");
    expect(schema.edges.find((e) => e.type === "no")!.label).toBe("No");
    expect(schema.edges.find((e) => e.type === "normal")!.label).toBeNull();
  });
});
