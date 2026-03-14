---
name: ayatori-flow-yaml
description: Generate business flowchart YAML for the Ayatori editor. Covers the complete FlowChartSchema spec, node/edge types, hydration defaults, and conventions. Use when asked to create a flowchart, business process flow, workflow diagram, or Ayatori YAML.
---

# Ayatori FlowChart YAML

Ayatori は業務フローチャートの双方向エディタ。AI はコンパクトな YAML を出力し、Ayatori がデフォルト値を自動補完（hydrate）して描画する。

## 出力フォーマット

**YAML** で出力する。JSON ではない。YAML は括弧不要でトークン効率が高く、構造破損リスクが低い。

## スキーマ構造

```yaml
meta:          # 必須
  name: string           # フロー名称
  purpose: string        # 目的。「〜が完了するまで」で終わること
  granularity: string    # "executive" | "business" | "engineer"
  version: string        # YYYY-MM-DD
  subtitle: string       # 省略可
lanes:         # 必須。1つ以上
  - id: string           # "lane-xxx" 形式
    label: string        # 表示名
phases:        # 省略可（デフォルト: なし）
  - id: string           # "phase-xxx" 形式
    label: string
nodes:         # 必須。2つ以上（最低 start + end）
  - id: string           # "n1", "n-xxx" 等
    type: string         # ノード種別（下記参照）
    label: string        # 図形内テキスト
    lane: string         # 所属レーンID
edges:         # 必須。1つ以上
  - id: string           # "e1", "exx" 等
    source: string       # 始点ノードID
    target: string       # 終点ノードID
designNotes:   # 省略可
  - string
openQuestions:  # 省略可
  - string
```

## ノード種別（type）

| type | 図形 | 用途 | デフォルト style |
|------|------|------|------------------|
| `start` | 楕円 | フロー開始点 | `default`（白） |
| `end` | 楕円 | フロー終了点 | `default` |
| `process` | 角丸矩形 | 通常の処理ステップ | `default` |
| `decision` | ダイヤモンド | Yes/No 分岐 | `default` |
| `data` | 矩形 | データ/システム連携 | `gray` |
| `manual` | 矩形 | 手作業・課題ステップ | `orange` |
| `reference` | 矩形 | 別ノードへの参照 | `blue-ref` |

## ノードの省略可能フィールド

以下は省略するとデフォルト値が自動補完される。**明示不要なら書かない。**

| フィールド | デフォルト値 | 説明 |
|-----------|-------------|------|
| `sublabel` | なし | 主テキスト下の補足（例: システム名） |
| `phase` | なし | 所属フェーズID |
| `style` | type から自動判定 | 上表参照。type と異なる色にしたい時のみ指定 |
| `comments` | 空 | レビューコメント |
| `decisionMeta` | decision時は自動生成 | 分岐の詳細設定 |
| `referenceTargetId` | なし | reference ノード専用 |
| `timeLabel` | なし | 日次運用等の時間帯ラベル |

### style の選択肢

`default`（白）/ `gray`（灰）/ `orange`（橙）/ `green`（緑）/ `blue-ref`（青）/ `hypothesis`（点線ボーダー）

type のデフォルトと異なる色にしたい場合のみ明示する。例: process ノードを橙色にしたい場合 `style: orange`

## エッジ種別（type）

| type | 見た目 | 自動ラベル | 用途 |
|------|--------|-----------|------|
| 省略 / `normal` | 黒実線矢印 | なし | 通常の流れ |
| `yes` | 黒実線矢印 | "Yes" | 分岐の Yes 側 |
| `no` | 黒実線矢印 | "No" | 分岐の No 側（右方向） |
| `loop` | 灰色点線矢印 | なし | ループ戻り |
| `hypothesis` | 黒点線矢印 | なし | 仮説的な流れ |
| `merge` | 矢印なし | なし | 合流線 |

**normal は省略可能。** yes/no はラベルが自動付与されるので `label` フィールドも不要。

## エッジの省略可能フィールド

| フィールド | デフォルト値 |
|-----------|-------------|
| `type` | `normal` |
| `label` | type に応じて自動（yes→"Yes", no→"No", 他→なし） |
| `comments` | 空 |

## レーン・フェーズの order

`order` フィールドは省略可能。**配列の並び順がそのまま表示順になる。**

## 分岐（decision）の書き方

decision ノードには `decisionMeta` を書ける。省略すると以下のデフォルトが適用される:

```yaml
decisionMeta:
  branchNumber: 1        # 通し番号
  yesDirection: down     # Yes は下方向（デフォルト）
  noDirection: right     # No は右方向（デフォルト）
```

分岐番号だけ指定したい場合:

```yaml
decisionMeta:
  branchNumber: 2
```

## 設計ルール

1. **start ノードで始まり、end ノードで終わる**。複数の end があってよい
2. **全ノードは lanes のいずれかに所属する**（`lane` フィールド必須）
3. **分岐は「Yes が多数派（正常系）」の問いにする**。例: 「不備はないか」→ Yes（不備なし）が正常系
4. **ノード label は動詞「〜する」で統一**。例: 「申請書を作成する」「承認する」
5. **分岐 label は疑問形**。例: 「内容に不備はないか」
6. **改行はリテラルブロック `|-` を使う**（YAML 記法）
7. **ID の命名**: ノード `n1`, `n-xxx`。エッジ `e1`, `exx`。レーン `lane-xxx`。フェーズ `phase-xxx`
8. **purpose は「〜が完了するまで」で終わる**
9. **layout は書かない**（自動レイアウトエンジンが計算する）

## フェーズの使い方

業務が複数フェーズに分かれる場合に使用。各ノードに `phase` で所属を指定する。

```yaml
phases:
  - id: phase-a
    label: "Phase A：導入"
  - id: phase-b
    label: "Phase B：運用"

nodes:
  - id: n1
    type: start
    label: 導入開始
    lane: lane-admin
    phase: phase-a
```

## timeLabel の使い方

日次運用フローなど、時間軸に沿った流れを表現する場合:

```yaml
- id: n-b1
  type: process
  label: 事前予約する
  lane: lane-user
  phase: phase-daily
  timeLabel: 2日以上前
```

## テンプレート

```yaml
meta:
  name: [フロー名]
  purpose: [〜が完了するまで]
  granularity: business
  version: [YYYY-MM-DD]

lanes:
  - id: lane-[role1]
    label: [ロール名1]
  - id: lane-[role2]
    label: [ロール名2]

nodes:
  - id: n1
    type: start
    label: [開始イベント]
    lane: lane-[role]

  # ... 中間ノード ...

  - id: n-end
    type: end
    label: [終了イベント]
    lane: lane-[role]

edges:
  - id: e1
    source: n1
    target: [次のノード]
  # ...

designNotes:
  - [設計判断の理由]

openQuestions:
  - [未確定事項]
```

## 完全な例

2つの実例が [examples.md](examples.md) にある。
- **簡単な承認フロー**: 6ノード / 5エッジ / 分岐あり
- **AsIs 体験フロー**: 16ノード / 15エッジ / 3フェーズ / timeLabel あり
