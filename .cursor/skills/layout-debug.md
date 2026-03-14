# Skill: レイアウトエンジンのデバッグ手法

## いつ使うか

- フローチャートのノード間に不自然な隙間・重なりがある場合
- レイアウト結果が期待と異なる場合（位置ずれ、間隔の不均一など）
- `src/layout/engine.ts` の post-processing パイプラインにバグが疑われる場合

## 概要

Ayatori のレイアウトは **ELK → 5段階の後処理** で構成される。UI上の見た目だけでは原因の切り分けが困難なため、**各段階の出力を数値で確認する debug スクリプト** を書いて原因を特定する。

## レイアウトパイプライン

```
ELK (layered, DOWN)
  → alignNodesByLane      … 同一レーン内ノードの X 統一
  → resolveYConflicts     … 同一レーン内の Y 重複解消
  → enforcePhaseOrdering  … フェーズ間の上下順序保証
  → applyShortBranches    … 短い No 分岐の横配置
  → insertPhaseGaps       … フェーズヘッダー分の余白挿入
```

## 手順

### 1. 対象データの特定

問題のフローの YAML を取得する。サンプルデータは `public/sample-flows/` にある。

### 2. debug スクリプトの作成

プロジェクトルートに一時ファイル（例: `debug-layout.ts`）を作成し、レイアウトエンジンを直接呼び出して全ノードの座標を出力する。

```typescript
import { readFileSync } from "fs";
import { yamlToSchema } from "./src/schema/yaml.ts";
import { calculateLayout, computeAllSizes } from "./src/layout/engine.ts";
import { SPACING } from "./src/layout/constants.ts";

async function main() {
  const yamlStr = readFileSync("public/sample-flows/asis-flow.yaml", "utf-8");
  const schema = yamlToSchema(yamlStr);
  const sizes = computeAllSizes(schema);
  const layout = await calculateLayout(schema);

  // 全ノードの座標を出力
  for (const node of schema.nodes) {
    const pos = layout.positions[node.id];
    const size = sizes.get(node.id)!;
    const halfH =
      node.type === "decision" || node.type === "start" || node.type === "end"
        ? size.height
        : size.height / 2;
    console.log(
      `${node.id.padEnd(12)} phase=${(node.phase ?? "null").padEnd(10)} ` +
      `lane=${node.lane.padEnd(15)} y=${pos.y.toFixed(1).padStart(8)} ` +
      `top=${(pos.y - halfH).toFixed(1).padStart(8)} ` +
      `bottom=${(pos.y + halfH).toFixed(1).padStart(8)}`
    );
  }

  // 問題のあるノード間のギャップを計算
  const targetIds = ["n-c1", "n-c2", "n-c3"]; // ← 調査対象に変更
  console.log("\n=== Gap Analysis ===");
  for (let i = 1; i < targetIds.length; i++) {
    const prev = schema.nodes.find((n) => n.id === targetIds[i - 1])!;
    const curr = schema.nodes.find((n) => n.id === targetIds[i])!;
    const prevSize = sizes.get(prev.id)!;
    const currSize = sizes.get(curr.id)!;
    const prevHalfH = prev.type === "process" ? prevSize.height / 2 : prevSize.height;
    const currHalfH = curr.type === "process" ? currSize.height / 2 : currSize.height;
    const prevBottom = layout.positions[prev.id].y + prevHalfH;
    const currTop = layout.positions[curr.id].y - currHalfH;
    console.log(
      `  ${prev.id} → ${curr.id}: gap=${(currTop - prevBottom).toFixed(1)} (expected: ${SPACING.M_VERTICAL})`
    );
  }
}

main().catch(console.error);
```

### 3. 実行

```bash
npx tsx debug-layout.ts
```

### 4. ギャップの異常を確認

期待値 (`SPACING.M_VERTICAL` = 64) と実測値を比較する。ギャップが異常なノードペアを特定する。

### 5. パイプライン各段階の座標をトレース

異常が見つかったら、`calculateLayout` の中間結果をトレースするスクリプトに拡張する。各後処理ステップ間でノード座標をダンプし、**どのステップで異常なギャップが発生したか** を特定する。

```typescript
// パイプライン各ステップを個別に呼び出して座標をダンプする構成例:
//
// 1. ELK 実行 → positions 取得 → ログ出力
// 2. alignNodesByLane → ログ出力
// 3. resolveYConflicts → ログ出力  ← ここで問題発見されることが多い
// 4. enforcePhaseOrdering → ログ出力
// 5. applyShortBranches → ログ出力
// 6. insertPhaseGaps → ログ出力
//
// 各ステップ間で対象ノードの y, top, bottom, gap を比較する。
```

`resolveYConflicts` 内部の制約チェック（predecessor 制約、lane overlap 制約）をトレースする場合は、対象ノードの処理時にログを挿入する:

```typescript
// resolveYConflicts 内部のトレース例:
for (const predId of predecessors.get(nodeId) ?? []) {
  // ...
  if (isTargetNode) {
    console.log(`  [${nodeId}] Predecessor ${predId}: predBottom=${predBottom}, newMinY=${newMinY}`);
  }
}
for (const peer of lanePeers) {
  // ...
  if (isTargetNode && overlapDetected) {
    console.log(`  [${nodeId}] Lane overlap with peer: peerBottom=${peerBottom}, pushed to ${newMinY}`);
  }
}
```

### 6. 修正と検証

原因が特定できたらコードを修正し、同じ debug スクリプトで修正後の座標が期待値通りかを確認する。

### 7. クリーンアップ

debug スクリプト（`debug-layout.ts` 等）はコミット前に必ず削除する。

## ノードサイズの注意点

`ShapeSize` の解釈はノードタイプによって異なる:

| ノードタイプ | `size.width` / `size.height` の意味 | ELK に渡すサイズ | halfH の取得 |
|---|---|---|---|
| `process`, `data`, `manual`, `reference` | **フルサイズ** | そのまま | `size.height / 2` |
| `decision`, `start`, `end` | **半分のサイズ** | `* 2` | `size.height` |

## よくある原因パターン

| 症状 | 調べるべきステップ | 典型的な原因 |
|---|---|---|
| 同一レーン内の隙間が不均一 | `resolveYConflicts` | 異なるフェーズのノードとの overlap チェックが干渉 |
| レーンを跨ぐと隙間が広がる | `enforcePhaseOrdering` | 異なるレーンのフェーズ最下端が不整合 |
| フェーズ境界で異常な余白 | `insertPhaseGaps` | `requiredGap` の計算や `boundaryY` の判定ミス |
| ノードが重なる | `resolveYConflicts` | predecessor 制約 or lane overlap 制約の不足 |
| 短い分岐の位置がずれる | `applyShortBranches` | decision ノードのサイズ計算ミス |

## 関連ファイル

- `src/layout/engine.ts` — レイアウトエンジン本体
- `src/layout/constants.ts` — 間隔定数 (`SPACING`, `LANE`, `PHASE`)
- `src/layout/sizing.ts` — テキスト計測・図形サイズ計算
- `src/layout/edge-routing.ts` — エッジのハンドル位置決定
- `tests/layout/engine.test.ts` — レイアウトのユニットテスト
- `public/sample-flows/` — サンプルフローデータ (YAML)
