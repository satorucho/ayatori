import { describe, it, expect } from "vitest";
import { parseTextFlow } from "../../src/parser/text-flow-parser.ts";

const SAMPLE_TEXT = `# 会計処理フロー

## メタ情報
- フロー名: 簡易会計処理フロー
- 目的: 経費精算が完了するまで
- 粒度: 業務担当・PM向け
- レーン: 申請者/経理担当

## フロー構造

開始（経費精算開始）
↓
申請書を作成する（経費システム）
↓
分岐①: 金額は規定以内か
Yes↓
承認する（経費システム）
No → 差し戻す
↓
完了

## 設計判断メモ
- 分岐①: 規定以内（Yes）が多数派のため正常系にした

## 要確認事項
- ①10万円以上の場合の追加承認フローが必要か
`;

describe("parseTextFlow", () => {
  it("テキストフローを正しくパースできる", () => {
    const result = parseTextFlow(SAMPLE_TEXT);

    expect(result.schemaVersion).toBe("1");
    expect(result.meta.name).toBe("簡易会計処理フロー");
    expect(result.meta.purpose).toBe("経費精算が完了するまで");
    expect(result.meta.granularity).toBe("business");
  });

  it("レーンが正しくパースされる", () => {
    const result = parseTextFlow(SAMPLE_TEXT);
    expect(result.lanes).toHaveLength(2);
    expect(result.lanes[0].label).toBe("申請者");
    expect(result.lanes[1].label).toBe("経理担当");
  });

  it("ノードが生成される", () => {
    const result = parseTextFlow(SAMPLE_TEXT);
    expect(result.nodes.length).toBeGreaterThanOrEqual(4);

    const startNode = result.nodes.find((n) => n.type === "start");
    expect(startNode).toBeDefined();

    const endNode = result.nodes.find((n) => n.type === "end");
    expect(endNode).toBeDefined();

    const decisionNode = result.nodes.find((n) => n.type === "decision");
    expect(decisionNode).toBeDefined();
    expect(decisionNode!.decisionMeta).not.toBeNull();
  });

  it("エッジが生成される", () => {
    const result = parseTextFlow(SAMPLE_TEXT);
    expect(result.edges.length).toBeGreaterThanOrEqual(3);

    const noEdge = result.edges.find((e) => e.type === "no");
    expect(noEdge).toBeDefined();
  });

  it("設計判断メモが含まれる", () => {
    const result = parseTextFlow(SAMPLE_TEXT);
    expect(result.designNotes.length).toBeGreaterThan(0);
  });

  it("要確認事項が含まれる", () => {
    const result = parseTextFlow(SAMPLE_TEXT);
    expect(result.openQuestions.length).toBeGreaterThan(0);
  });
});
