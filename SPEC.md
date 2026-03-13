# Ayatori — 設計書

**Ayatori** (あやとり) — 糸で図形を作り、繋ぎ替えて新たな形を紡ぐ日本の遊びに着想を得た、業務フローチャートの双方向エディタ。

- npm: `ayatori`
- GitHub: `exxinc/ayatori` (仮)
- ライセンス: MIT

Coding Agent 向けの完全な実装仕様。本ドキュメントに従えば、外部への質問なしに実装を完了できることを目指す。

---

## 0. プロジェクト概要

### 0-1. 目的

業務フローチャートの「構造化データ ⇄ ビジュアル編集」を双方向で実現するReactアプリケーションを構築する。

### 0-2. 解決する課題

| #   | 現行の課題            | 本プロジェクトでの解決策                           |
| --- | --------------------- | -------------------------------------------------- |
| 1   | SVG直書きで出力不安定 | JSON Schema → 確定的レイアウトエンジン → React描画 |
| 2   | GUI編集不可           | React Flow ベースのインタラクティブエディタ        |
| 3   | 修正指示が困難        | ノード/エッジへのコメント機構 + AI修正ループ       |

### 0-3. 技術スタック

| レイヤー       | 技術                           | バージョン |
| -------------- | ------------------------------ | ---------- |
| フレームワーク | React 18+                      | latest     |
| ビルド         | Vite                           | latest     |
| 言語           | TypeScript (strict)            | 5.x        |
| ダイアグラムUI | @xyflow/react (React Flow)     | 12.x       |
| 自動レイアウト | elkjs                          | 0.9.x      |
| スタイリング   | Tailwind CSS 3                 | 3.x        |
| フォント       | Noto Sans JP (Google Fonts)    | -          |
| テスト         | Vitest + React Testing Library | latest     |

### 0-4. リポジトリ構造

```
ayatori/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── public/
│   └── sample-flows/          # サンプルJSONファイル
│       ├── simple-flow.json
│       └── asis-flow.json
├── src/
│   ├── main.tsx               # エントリーポイント
│   ├── App.tsx                # ルートコンポーネント
│   ├── types/
│   │   └── schema.ts          # FlowChart Schema 型定義
│   ├── schema/
│   │   ├── validate.ts        # JSON Schema バリデーション
│   │   ├── defaults.ts        # デフォルト値生成
│   │   └── migrate.ts         # スキーマバージョン移行
│   ├── parser/
│   │   └── text-flow-parser.ts # テキストフロー → JSON 変換
│   ├── layout/
│   │   ├── engine.ts          # レイアウトエンジン本体
│   │   ├── sizing.ts          # 図形サイズ計算（style-guide §6 相当）
│   │   ├── constants.ts       # レイアウト定数
│   │   └── types.ts           # レイアウト内部型
│   ├── editor/
│   │   ├── FlowEditor.tsx     # メインエディタコンポーネント
│   │   ├── Toolbar.tsx        # ツールバー（ファイル操作、レイアウト等）
│   │   ├── Sidebar.tsx        # サイドバー（プロパティ、コメント）
│   │   ├── nodes/
│   │   │   ├── index.ts       # nodeTypes エクスポート
│   │   │   ├── StartEndNode.tsx
│   │   │   ├── ProcessNode.tsx
│   │   │   ├── DecisionNode.tsx
│   │   │   ├── DataNode.tsx
│   │   │   ├── ManualNode.tsx
│   │   │   └── ReferenceNode.tsx
│   │   ├── edges/
│   │   │   ├── index.ts       # edgeTypes エクスポート
│   │   │   └── FlowEdge.tsx   # カスタムエッジ（Yes/No/loop等対応）
│   │   ├── overlays/
│   │   │   ├── LaneOverlay.tsx    # レーンヘッダー＋区切り線
│   │   │   ├── PhaseOverlay.tsx   # Phase帯
│   │   │   └── CommentBadge.tsx   # コメントバッジ
│   │   └── hooks/
│   │       ├── useFlowState.ts    # Schema ⇄ React Flow state 変換
│   │       ├── useAutoLayout.ts   # ELK レイアウト実行
│   │       ├── useComments.ts     # コメント管理
│   │       └── useUndoRedo.ts     # undo/redo
│   ├── export/
│   │   ├── to-svg.ts         # SVGエクスポート
│   │   ├── to-png.ts         # PNGエクスポート
│   │   └── to-html.ts        # 現行スキル互換HTML出力
│   └── utils/
│       ├── text-measure.ts    # テキスト幅計算（§6-1〜§6-3）
│       └── id.ts              # ID生成
└── tests/
    ├── layout/
    │   ├── sizing.test.ts
    │   └── engine.test.ts
    ├── parser/
    │   └── text-flow-parser.test.ts
    └── schema/
        └── validate.test.ts
```

---

## 1. FlowChart Schema（型定義）

### 1-1. `src/types/schema.ts`

以下の型定義を **そのまま** 使用する。命名規則やフィールドの追加・削除は禁止。

```typescript
// ============================================================
// Ayatori FlowChart Schema v1
// ============================================================

/** スキーマのルートオブジェクト */
export interface FlowChartSchema {
  /** スキーマバージョン。常に "1" */
  schemaVersion: "1";
  /** フローのメタ情報 */
  meta: FlowMeta;
  /** レーン定義（1つ以上） */
  lanes: Lane[];
  /** Phase定義（0個以上） */
  phases: Phase[];
  /** ノード定義（2つ以上: 最低でも開始+終了） */
  nodes: FlowNode[];
  /** エッジ定義（1つ以上） */
  edges: FlowEdge[];
  /** レイアウト情報（自動計算 or 手動配置）。nullの場合は自動レイアウトを実行 */
  layout: FlowLayout | null;
  /** 設計判断メモ */
  designNotes: string[];
  /** 要確認事項 */
  openQuestions: string[];
}

// ---- Meta ----

export interface FlowMeta {
  /** フロー名称 */
  name: string;
  /** 目的。「〜が完了するまで」で終わること */
  purpose: string;
  /** 粒度レベル */
  granularity: "executive" | "business" | "engineer";
  /** バージョン文字列 (YYYY-MM-DD 推奨) */
  version: string;
  /** サブタイトル / 概要説明 */
  subtitle?: string;
}

// ---- Lane ----

export interface Lane {
  /** 一意ID (例: "lane-admin") */
  id: string;
  /** 表示名 (例: "管理者") */
  label: string;
  /** 左から右への表示順序 (0始まり) */
  order: number;
}

// ---- Phase ----

export interface Phase {
  /** 一意ID (例: "phase-a") */
  id: string;
  /** 表示名 (例: "Phase A：導入・登録") */
  label: string;
  /** 上から下への表示順序 (0始まり) */
  order: number;
}

// ---- Node ----

/** ノードの種別 */
export type NodeType =
  | "start" // 開始（楕円）
  | "end" // 終了（楕円）
  | "process" // 処理（角丸矩形）
  | "decision" // 分岐（ダイヤモンド）
  | "data" // データ/システム（灰色矩形）
  | "manual" // 手作業・課題（オレンジ矩形）
  | "reference"; // 参照ノード（青矩形）

/** ノードのスタイルバリアント */
export type NodeStyle =
  | "default" // 白地 + #222
  | "gray" // #eee + #222
  | "orange" // #fff4e5 + #c87800
  | "green" // #e8f4e8 + #2a7a2a
  | "blue-ref" // #f0f7ff + #4a4aff
  | "hypothesis"; // 点線ボーダー

export interface FlowNode {
  /** 一意ID (例: "n1", "node-start") */
  id: string;
  /** ノード種別 */
  type: NodeType;
  /** 主テキスト（図形内に表示） */
  label: string;
  /** 補足テキスト（主テキストの下に小さく表示。nullの場合は非表示） */
  sublabel: string | null;
  /** 所属レーンID */
  lane: string;
  /** 所属PhaseID（Phase未使用の場合はnull） */
  phase: string | null;
  /** スタイルバリアント。通常は type から自動判定するが、明示指定も可能 */
  style: NodeStyle;
  /** コメント */
  comments: Comment[];
  /**
   * 分岐ノード(decision)の場合の追加情報。
   * decision 以外のノードでは null。
   */
  decisionMeta: DecisionMeta | null;
  /**
   * 参照先ノードID。reference タイプの場合のみ使用。
   * 参照先ノードと同じテキスト・同じ色で描画される。
   */
  referenceTargetId: string | null;
  /**
   * タイムゾーンラベル（日次運用フロー等で使用）。
   * 例: "2日以上前", "前日", "当日朝〜締切"
   * null の場合は非表示。
   */
  timeLabel: string | null;
}

export interface DecisionMeta {
  /** 分岐番号（通し番号: 1, 2, 3...） */
  branchNumber: number;
  /**
   * Yes/Noの方向。
   * 標準: yesDirection="down", noDirection="right"
   * 反転パターン: yesDirection="down", noDirection="right"（意味が反転するだけで方向は同じ）
   */
  yesDirection: "down" | "right";
  noDirection: "down" | "right";
}

// ---- Edge ----

/** エッジの種別 */
export type EdgeType =
  | "normal" // 通常矢印（黒実線）
  | "yes" // Yes分岐（黒実線 + "Yes"ラベル）
  | "no" // No分岐（黒実線 + "No"ラベル）
  | "loop" // ループ戻り（灰色点線）
  | "hypothesis" // 仮説（黒点線）
  | "merge"; // 合流線（矢印なし）

export interface FlowEdge {
  /** 一意ID (例: "e1") */
  id: string;
  /** 始点ノードID */
  source: string;
  /** 終点ノードID */
  target: string;
  /** エッジ種別 */
  type: EdgeType;
  /** エッジ上のラベル（"Yes", "No" 等。null の場合はラベルなし） */
  label: string | null;
  /** コメント */
  comments: Comment[];
}

// ---- Comment ----

export interface Comment {
  /** 一意ID */
  id: string;
  /** 作成者: "user" はユーザー、"ai" はAI */
  author: "user" | "ai";
  /** コメント本文 */
  text: string;
  /** 解決済みフラグ。AIが修正を完了したらtrue */
  resolved: boolean;
  /** 作成日時 (ISO 8601) */
  createdAt: string;
}

// ---- Layout ----

export interface FlowLayout {
  /** 各ノードの座標。キーはノードID */
  positions: Record<string, NodePosition>;
  /** ビューポート情報 */
  viewport: Viewport;
}

export interface NodePosition {
  /** 中心X座標 */
  x: number;
  /** 中心Y座標 */
  y: number;
  /**
   * 手動配置済みフラグ。
   * true の場合、自動レイアウトで上書きしない。
   * false または undefined の場合、自動レイアウトの対象。
   */
  pinned?: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
```

### 1-2. スタイルの自動判定ルール

`type` から `style` を自動判定する関数を `schema/defaults.ts` に実装する。

```
start    → "default"
end      → "default"
process  → "default"
decision → "default"
data     → "gray"
manual   → "orange"
reference → "blue-ref"
```

ユーザーが明示的に `style` を指定した場合はそちらを優先する。

---

## 2. レイアウトエンジン

### 2-1. 概要

`src/layout/engine.ts` に実装。`FlowChartSchema` を受け取り、`FlowLayout` を返す純粋関数。

```typescript
export async function calculateLayout(
  schema: FlowChartSchema,
  options?: LayoutOptions,
): Promise<FlowLayout>;

export interface LayoutOptions {
  /** 強制再レイアウト（pinned ノードも再計算） */
  force?: boolean;
}
```

### 2-2. 定数 (`src/layout/constants.ts`)

現行 style-guide の値をすべてコード化する。**この定数ファイルがレイアウトの唯一の真実の源泉（Single Source of Truth）である。**

```typescript
// ============================================================
// レイアウト定数（style-guide.md 完全準拠）
// ============================================================

// ---- フォント ----
export const FONT_FAMILY = "'Noto Sans JP', sans-serif";

export const FONT = {
  title: { size: 24, weight: 700 },
  laneHeader: { size: 20, weight: 700 },
  nodeMain: { size: 16, weight: 600 },
  nodeSub: { size: 12, weight: 400 },
} as const;

// ---- テキスト計算 ----
export const TEXT = {
  /** 全角文字幅 = fontSize * 1.05 */
  fullWidthRatio: 1.05,
  /** 半角文字幅 = fontSize * 0.6 */
  halfWidthRatio: 0.6,
  /** 行の高さ = fontSize * 1.5 */
  lineHeightRatio: 1.5,
  /** 左右パディング */
  paddingX: 24,
  /** 上下パディング */
  paddingY: 10,
} as const;

// ---- 図形最小サイズ ----
export const MIN_SIZE = {
  rect: { width: 220, height: 40 },
  rectShort: { width: 100, height: 36 }, // 短い枝用
  diamond: { W: 110, H: 50 },
  ellipse: { rx: 50, ry: 20 },
} as const;

// ---- スペーシング（矢印パターン） ----
export const SPACING = {
  /** パターンM 垂直間隔（ノード端間） */
  M_VERTICAL: 64,
  /** パターンM 水平間隔（ノード端間） */
  M_HORIZONTAL: 80,
  /** パターンS 垂直間隔（合流専用） */
  S_VERTICAL: 24,
  /** パターンL 最小ノード端間隔 */
  L_MIN: 84,
} as const;

// ---- 矢印ギャップ ----
export const ARROW_GAP = {
  /** 始点ギャップ（ノード端から） */
  start: 6,
  /** 終点ギャップ（ノード端から） */
  end: 6,
  /** marker補正（終点のみ追加） */
  marker: 8,
} as const;

// ---- レーン配置 ----
export const LANE = {
  /** SVG左余白 */
  marginLeft: 40,
  /** SVG右余白 */
  marginRight: 40,
  /** SVG上余白 */
  marginTop: 40,
  /** SVG下余白 */
  marginBottom: 40,
  /** レーン間余白 */
  gapBetweenLanes: 80,
  /** レーンヘッダー高さ */
  headerHeight: 50,
  /** 黒帯 rect の区切り線からの内側余白 */
  headerInset: 30,
  /** No→縦線のYes側最大右端からの距離 */
  mergeLineOffset: 30,
} as const;

// ---- Phase帯 ----
export const PHASE = {
  /** 左端X座標 */
  x: 40,
  /** 幅 */
  width: 200,
  /** 高さ */
  height: 30,
  /** テキスト左寄せX */
  textX: 55,
  /** Phase帯右端からフロー本体までの最小間隔 */
  gapToFlow: 34,
} as const;

// ---- ダイヤモンド ----
export const DIAMOND = {
  /** 内接矩形→外接ダイヤモンドの変換係数 */
  scaleFactor: 1.42,
  /** テキスト最大行数 */
  maxLines: 2,
  /** テキスト最大全角文字数/行 */
  maxCharsPerLine: 8,
} as const;

// ---- 楕円 ----
export const ELLIPSE = {
  /** rx追加係数（楕円端のテキスト幅減少を補正） */
  rxScale: 1.2,
  /** テキスト最大行数 */
  maxLines: 2,
} as const;

// ---- 幅統一 ----
export const WIDTH_UNIFY = {
  /** 同一列内で最大幅との差がこれ以上なら個別幅を使用 */
  threshold: 100,
} as const;

// ---- 列 ----
export const COLUMN = {
  /** 最大列数（列0含む） */
  maxColumns: 3,
} as const;

// ---- カラーパレット ----
export const COLORS = {
  default: { fill: "#fff", stroke: "#222", text: "#222" },
  startEnd: { fill: "#f5f5f5", stroke: "#222", text: "#222" },
  gray: { fill: "#eee", stroke: "#222", text: "#222" },
  orange: { fill: "#fff4e5", stroke: "#c87800", text: "#c87800" },
  green: { fill: "#e8f4e8", stroke: "#2a7a2a", text: "#2a7a2a" },
  "blue-ref": { fill: "#f0f7ff", stroke: "#4a4aff", text: "#4a4aff" },
  hypothesis: { fill: "#fff", stroke: "#aaa", text: "#888" },
  sub: { text: "#999" },
  laneHeader: { fill: "#222", text: "#fff" },
  phase: { fill: "#f0f0f0", stroke: "#999", text: "#555" },
  arrow: { default: "#222", loop: "#888", orange: "#c87800", green: "#2a7a2a" },
} as const;
```

### 2-3. テキスト計算 (`src/layout/sizing.ts`)

#### 2-3-1. 文字種判定

```typescript
/**
 * 文字が全角かどうかを判定する。
 * Unicode の CJK統合漢字、ひらがな、カタカナ、全角記号を全角扱い。
 * ASCII、半角カタカナを半角扱い。
 */
export function isFullWidth(char: string): boolean;
```

判定基準:

- U+3000-U+303F (CJK句読点) → 全角
- U+3040-U+309F (ひらがな) → 全角
- U+30A0-U+30FF (カタカナ) → 全角
- U+4E00-U+9FFF (CJK統合漢字) → 全角
- U+FF01-U+FF60 (全角ASCII) → 全角
- U+FF65-U+FF9F (半角カタカナ) → 半角
- それ以外 → 半角

#### 2-3-2. テキスト幅計算

```typescript
export interface TextMetrics {
  /** 各行の情報 */
  lines: LineMetrics[];
  /** 全行の最大幅 (px) */
  maxWidth: number;
  /** 全行の合計高さ (px) */
  totalHeight: number;
}

export interface LineMetrics {
  text: string;
  fontSize: number;
  fullWidthCount: number;
  halfWidthCount: number;
  width: number; // fullWidthCount * fontSize * 1.05 + halfWidthCount * fontSize * 0.6
  height: number; // fontSize * 1.5
}

/**
 * ノードのテキストメトリクスを計算する。
 * label は fontSize=16 で計算、sublabel は fontSize=12 で計算。
 * 必要に応じて改行を挿入する。
 */
export function measureNodeText(
  label: string,
  sublabel: string | null,
  nodeType: NodeType,
): TextMetrics;
```

改行挿入の優先切れ目:

1. 助詞（の、は、が、を、に、へ、で、と、も、や、か）の直後
2. 読点（、）の直後
3. 括弧（（）の直前
4. スラッシュ（/）の前後

ダイヤモンドの場合は最大2行×8全角文字に制限。超過する場合はエラーとする（自動短縮はしない）。

#### 2-3-3. 図形サイズ計算

```typescript
export interface ShapeSize {
  /** 矩形の場合: 幅。ダイヤモンドの場合: W（中心からの水平距離）。楕円の場合: rx */
  width: number;
  /** 矩形の場合: 高さ。ダイヤモンドの場合: H（中心からの垂直距離）。楕円の場合: ry */
  height: number;
}

/**
 * テキストメトリクスからノードの図形サイズを計算する。
 * 最小サイズを適用する。
 */
export function calculateShapeSize(
  metrics: TextMetrics,
  nodeType: NodeType,
  isShortBranch: boolean,
): ShapeSize;
```

**矩形:**

```
幅 = max(metrics.maxWidth + 48, MIN_SIZE.rect.width)   // 短い枝の場合は MIN_SIZE.rectShort
高さ = max(metrics.totalHeight + 20, MIN_SIZE.rect.height)
```

**ダイヤモンド:**

```
innerW = metrics.maxWidth + 48
innerH = metrics.totalHeight + 20
W = max(ceil(innerW / 2 * 1.42), MIN_SIZE.diamond.W)
H = max(ceil(innerH / 2 * 1.42), MIN_SIZE.diamond.H)
```

**楕円:**

```
rx = max(metrics.maxWidth / 2 * 1.2 + 24, MIN_SIZE.ellipse.rx)
ry = max(metrics.totalHeight / 2 + 10, MIN_SIZE.ellipse.ry)
```

#### 2-3-4. 同一列内の幅統一

```typescript
/**
 * 同一列内の矩形幅を最大値に統一する。
 * ただし最大値との差が WIDTH_UNIFY.threshold 以上の矩形は個別幅を維持。
 * ダイヤモンドは統一対象外。
 */
export function unifyWidthsInColumn(
  sizes: Map<string, ShapeSize>,
  columnNodes: string[],
): void;
```

### 2-4. レイアウトエンジン本体 (`src/layout/engine.ts`)

#### 2-4-1. 処理フロー

```
入力: FlowChartSchema
  │
  ├─ Step 1: 全ノードの ShapeSize を計算 (sizing.ts)
  │    └─ 同一列内の幅統一
  │
  ├─ Step 2: ELK グラフ構築
  │    ├─ ノード → ELK children
  │    ├─ エッジ → ELK edges
  │    ├─ レーン → ELK partitioning 制約
  │    └─ Phase → ELK layerConstraint
  │
  ├─ Step 3: ELK レイアウト実行
  │    └─ 各ノードの (x, y) が確定
  │
  ├─ Step 4: 後処理
  │    ├─ 分岐合流Y座標の計算
  │    ├─ 短い枝の配置
  │    ├─ 列間干渉チェック
  │    └─ レーン区切り線の計算
  │
  └─ Step 5: FlowLayout 生成
       └─ 各ノードの中心座標 (CX, CY) を positions に格納

出力: FlowLayout
```

#### 2-4-2. ELK 設定

```typescript
const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.spacing.nodeNode": String(SPACING.M_VERTICAL),
  "elk.layered.spacing.nodeNodeBetweenLayers": String(SPACING.M_VERTICAL),
  "elk.spacing.edgeNode": "20",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  // レーン制約
  "elk.partitioning.activate": "true",
};
```

各ノードに `"elk.partitioning.partition"` を付与してレーン分離を実現する:

```typescript
{
  id: node.id,
  width: shapeSize.width,   // 矩形の場合。ダイヤモンドの場合は W*2, 楕円の場合は rx*2
  height: shapeSize.height, // 矩形の場合。ダイヤモンドの場合は H*2, 楕円の場合は ry*2
  "elk.partitioning.partition": laneIndex,
}
```

#### 2-4-3. 後処理: 分岐合流

ELK のレイアウト結果に対して、現行 style-guide §4-1 の合流ルールを適用する。

```typescript
/**
 * 各 decision ノードについて:
 * 1. Yes エッジの先の最終ノードの下端を求める
 * 2. 合流Y = その下端 + SPACING.M_VERTICAL
 * 3. No エッジの合流線の X = Yes側全ノードの最大右端 + LANE.mergeLineOffset
 * 4. No→の合流線がYes側のノード内部を通過しないことを検証
 */
function applyMergePoints(
  positions: Map<string, NodePosition>,
  schema: FlowChartSchema,
): void;
```

#### 2-4-4. 後処理: 短い枝

decision ノードの No→先が1ノードで完結する場合（＝ `FlowEdge.type === "no"` のtargetから出るedgeが合流のみ）:

```
短い枝ノードの CX = decision ノードの右端 + SPACING.M_HORIZONTAL + 短い枝ノード幅/2
短い枝ノードの CY = decision ノードの CY
```

短い枝は列を生成しない。

#### 2-4-5. 後処理: レーン区切り線

```typescript
interface LaneBoundary {
  laneId: string;
  minLeft: number;
  maxRight: number;
  dividerX: number; // 次のレーンとの区切り線X
}

/**
 * 全ノードの座標が確定した後:
 * 1. 各レーンの minLeft, maxRight を算出
 * 2. 区切り線X = (前レーン maxRight + 次レーン minLeft) / 2
 * 3. 干渉チェック: レーン内の全ノードの右端 < 区切り線X
 */
function calculateLaneDividers(positions, schema): LaneBoundary[];
```

### 2-5. React Flow への変換 (`src/editor/hooks/useFlowState.ts`)

```typescript
/**
 * FlowChartSchema + FlowLayout → React Flow の nodes[] + edges[] に変換。
 * 逆方向: React Flow の変更イベント → FlowChartSchema への反映。
 */
export function useFlowState(initialSchema: FlowChartSchema): {
  // React Flow 用
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Schema アクセス
  schema: FlowChartSchema;
  updateSchema: (updater: (prev: FlowChartSchema) => FlowChartSchema) => void;

  // レイアウト
  runAutoLayout: () => Promise<void>;

  // JSON入出力
  exportJSON: () => string;
  importJSON: (json: string) => void;
};
```

#### Schema → React Flow 変換ルール

| Schema フィールド                                            | React Flow Node フィールド                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `node.id`                                                    | `id`                                                                                                                         |
| `node.type`                                                  | `type` (カスタムノード名に変換: "start" → "startEnd", "end" → "startEnd", "process" → "process", "decision" → "decision" 等) |
| `node.label`, `node.sublabel`, `node.style`, `node.comments` | `data` オブジェクトに格納                                                                                                    |
| `layout.positions[node.id].x`, `.y`                          | `position: { x: x - width/2, y: y - height/2 }` (React Flowは左上基点なので中心座標から変換)                                 |

| Schema フィールド                          | React Flow Edge フィールド                         |
| ------------------------------------------ | -------------------------------------------------- |
| `edge.id`                                  | `id`                                               |
| `edge.source`                              | `source`                                           |
| `edge.target`                              | `target`                                           |
| `edge.type`                                | `type` ("flowEdge" 固定。edge.type は data に格納) |
| `edge.label`, `edge.type`, `edge.comments` | `data` オブジェクトに格納                          |

#### React Flow → Schema 逆変換

- **ノード移動**: `onNodesChange` で position 変更を検知 → `layout.positions[nodeId]` を更新 + `pinned: true`
- **エッジ繋ぎ替え**: `onConnect` で新しい接続を検知 → `edges` 配列を更新
- **ノード削除**: ノード削除イベント → `nodes` と関連 `edges` を削除
- **テキスト変更**: ノード data 変更 → `nodes[i].label` / `sublabel` を更新

---

## 3. カスタムノードコンポーネント

### 3-1. 共通仕様

すべてのカスタムノードは以下を満たす:

- React Flow の `NodeProps` を受け取る
- `Handle` コンポーネントで接続ポイントを配置
- ダブルクリックでテキスト編集モード
- コメントがある場合は右上にバッジ表示
- 選択時にハイライト枠

### 3-2. StartEndNode (`src/editor/nodes/StartEndNode.tsx`)

楕円形のノード。start と end の両方で使用。

```
描画:
  <svg> で楕円を描画。SVGを使う理由: HTMLのdivでは楕円のクリップが困難
  - ellipse: cx=width/2, cy=height/2, rx, ry
  - fill/stroke は style に基づく
  - テキスト: 中央揃え、font-size: 16px, font-weight: 600
  - sublabel がある場合: 2行目に font-size: 12px, fill: #999

Handle 配置:
  - start: Bottom のみ
  - end: Top のみ
```

### 3-3. ProcessNode (`src/editor/nodes/ProcessNode.tsx`)

角丸矩形。最も基本的なノード。

```
描画:
  <div> で角丸矩形を描画
  - border-radius: 3px
  - fill/stroke は style に基づく (default/gray/orange/green/blue-ref/hypothesis)
  - hypothesis の場合: border-style: dashed, border-dasharray: 4,2 相当

  テキスト:
  - 主テキスト: font-size: 16px, font-weight: 600, color: style.text
  - sublabel: font-size: 12px, color: #999

Handle 配置:
  - Top (入力)
  - Bottom (出力)
  - Right (No→出力。decision から接続される場合)
```

### 3-4. DecisionNode (`src/editor/nodes/DecisionNode.tsx`)

ダイヤモンド形。SVGで描画。

```
描画:
  <svg> で polygon を描画
  - points: "CX,0 W*2,H H,H*2 0,H" (ローカル座標)
  - fill: #fff, stroke: #222
  - テキスト: 中央、最大2行、font-size: 16px, font-weight: 600
  - 疑問符「？」は表示しない

Handle 配置:
  - Top (入力)
  - Bottom (Yes 出力)
  - Right (No 出力)
```

### 3-5. DataNode (`src/editor/nodes/DataNode.tsx`)

ProcessNode と同じ角丸矩形だが `fill: #eee`。実装は ProcessNode に style を渡して再利用可能。

### 3-6. ManualNode (`src/editor/nodes/ManualNode.tsx`)

ProcessNode と同じ角丸矩形だが `fill: #fff4e5, stroke: #c87800, text: #c87800`。

### 3-7. ReferenceNode (`src/editor/nodes/ReferenceNode.tsx`)

ProcessNode と同じ角丸矩形だが `fill: #f0f7ff, stroke: #4a4aff, text: #4a4aff`。参照先と同じテキストを表示。

### 3-8. nodeTypes 登録 (`src/editor/nodes/index.ts`)

```typescript
import { NodeTypes } from "@xyflow/react";

export const nodeTypes: NodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  data: DataNode,
  manual: ManualNode,
  reference: ReferenceNode,
};
```

---

## 4. カスタムエッジコンポーネント

### 4-1. FlowEdge (`src/editor/edges/FlowEdge.tsx`)

すべてのエッジに使用する統一コンポーネント。`data.edgeType` で描画を分岐。

```
描画ルール:
  normal:     stroke: #222, stroke-width: 1.2, marker-end: 三角形矢印
  yes:        同上 + ダイヤモンド直下に "Yes" ラベル (font-size: 12px, fill: #999)
  no:         同上 + ダイヤモンド直右に "No" ラベル
  loop:       stroke: #888, stroke-dasharray: "4,2", marker-end: 灰色矢印
  hypothesis: stroke: #aaa, stroke-dasharray: "4,2", marker-end: 三角形矢印
  merge:      stroke: #222, stroke-width: 1.0, marker-end: なし

Yes/No ラベル配置:
  - Yes: ソースノード(decision)の下辺から 15px 下、CX + 12px 右
  - No: ソースノード(decision)の右辺から 10px 右、CY - 7px 上
```

### 4-2. edgeTypes 登録

```typescript
export const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
};
```

---

## 5. オーバーレイ

React Flow の `<Panel>` や SVG背景として描画する、ノード/エッジ以外の要素。

### 5-1. LaneOverlay (`src/editor/overlays/LaneOverlay.tsx`)

```
描画:
  - レーン区切り線: 垂直の破線 (stroke: #ddd, stroke-width: 1)
  - レーンヘッダー: 黒帯 (fill: #222) + 白テキスト (font-size: 20px, font-weight: 700)
  - ヘッダーはフロー上部に固定配置

レーン区切り線のX座標はレイアウトエンジンが計算した LaneBoundary.dividerX を使用。
ヘッダーの幅は dividerX 間の幅 - headerInset*2。
```

### 5-2. PhaseOverlay (`src/editor/overlays/PhaseOverlay.tsx`)

```
描画:
  - Phase帯: 角丸矩形 (fill: #f0f0f0, stroke: #999, rx: 3)
  - 位置: 全レーンにまたがる幅、各Phaseの最初のノードのY座標に合わせる
  - テキスト: font-size: 16px, font-weight: 600, fill: #555

Phase帯のY座標は、そのPhaseに属する最初のノードの上端 - SPACING.M_VERTICAL で決定。
幅は SVG 全幅。
```

### 5-3. CommentBadge (`src/editor/overlays/CommentBadge.tsx`)

```
描画:
  - ノード右上に小さな円形バッジ (r=10, fill: #ff4444)
  - 未解決コメント数を白テキストで表示
  - クリックでサイドバーのコメントパネルを開く

表示条件:
  - comments.filter(c => !c.resolved).length > 0 の場合のみ表示
```

---

## 6. エディタ UI

### 6-1. FlowEditor (`src/editor/FlowEditor.tsx`)

メインのエディタコンポーネント。レイアウト構成:

```
┌───────────────────────────────────────────────────┐
│  Toolbar                                           │
├──────────────────────────────────┬─────────────────┤
│                                  │   Sidebar       │
│   React Flow Canvas              │   - Properties  │
│   (nodes, edges, overlays)       │   - Comments    │
│                                  │                 │
│                                  │                 │
├──────────────────────────────────┴─────────────────┤
│  Status Bar (ノード数、未解決コメント数)              │
└───────────────────────────────────────────────────┘
```

### 6-2. Toolbar (`src/editor/Toolbar.tsx`)

| ボタン                  | アクション                                    |
| ----------------------- | --------------------------------------------- |
| 📂 JSONを開く           | ファイル選択 → importJSON                     |
| 💾 JSONを保存           | exportJSON → ダウンロード                     |
| 📋 テキストフローを読込 | テキスト入力ダイアログ → parser → importJSON  |
| 🔄 自動レイアウト       | runAutoLayout()                               |
| ↩️ 元に戻す             | undo                                          |
| ↪️ やり直し             | redo                                          |
| ➕ ノード追加           | ドロップダウン: start/process/decision/end 等 |
| 📤 SVGエクスポート      | to-svg.ts                                     |
| 📤 HTMLエクスポート     | to-html.ts                                    |
| 🖨️ PNGエクスポート      | to-png.ts                                     |

### 6-3. Sidebar (`src/editor/Sidebar.tsx`)

選択中のノード/エッジのプロパティ編集とコメント表示。

#### Properties タブ

ノード選択時:

- type: ドロップダウン (start/end/process/decision/data/manual/reference)
- label: テキスト入力
- sublabel: テキスト入力
- lane: ドロップダウン
- phase: ドロップダウン
- style: ドロップダウン

エッジ選択時:

- type: ドロップダウン (normal/yes/no/loop/hypothesis/merge)
- label: テキスト入力

#### Comments タブ

- 未解決コメント一覧
- コメント追加ボタン
- コメント解決ボタン（resolved: true に更新）
- 全コメント（解決済み含む）の表示切替

### 6-4. コンテキストメニュー

ノードを右クリック時:

- テキスト編集
- ノード種別変更
- スタイル変更
- コメント追加
- ノード削除

エッジを右クリック時:

- エッジ種別変更
- コメント追加
- エッジ削除

キャンバスを右クリック時:

- ノード追加（カーソル位置に配置）

---

## 7. コメント機構と AIイテレーション

### 7-1. `useComments` フック (`src/editor/hooks/useComments.ts`)

```typescript
export function useComments(
  schema: FlowChartSchema,
  updateSchema: UpdateFn,
): {
  /** 指定要素にコメントを追加 */
  addComment: (
    targetType: "node" | "edge",
    targetId: string,
    text: string,
  ) => void;
  /** コメントを解決済みにする */
  resolveComment: (
    targetType: "node" | "edge",
    targetId: string,
    commentId: string,
  ) => void;
  /** 未解決コメント数 */
  unresolvedCount: number;
  /** 未解決コメント一覧（要素情報付き） */
  unresolvedComments: Array<{
    targetType: "node" | "edge";
    targetId: string;
    targetLabel: string;
    comment: Comment;
  }>;
};
```

### 7-2. AIイテレーションのワークフロー

```
[ユーザー操作]
1. エディタ上でノードを選択
2. 右クリック → "AIに修正依頼"
3. テキスト入力ダイアログにコメントを入力
4. comment が schema に追加される

[JSONエクスポート]
5. Toolbar の "JSONを保存" でエクスポート
6. JSON 内の comments にユーザーのコメントが含まれる

[AI処理]
7. ユーザーが JSON を AI（Claude等）に渡す
8. AI は JSON を読み込み、comments を確認
9. AI は修正を実施:
   - ノードの label/sublabel を変更
   - ノードの追加/削除
   - エッジの繋ぎ替え
   - 修正が完了したコメントの resolved を true に
10. AI は修正後の JSON を返す

[再読み込み]
11. ユーザーが修正後の JSON をエディタに読み込む
12. 解決済みコメントは表示されない（フィルタ）
13. 未解決のコメントがあればバッジが表示される
```

### 7-3. AI向けJSONフォーマットの注意事項

AIがJSONを処理する際のルール（本設計書の利用者に伝えるための情報）:

- `comments` 配列内の `resolved: false` のコメントのみ処理対象
- コメントの `text` に修正指示が含まれる
- 修正後、該当コメントの `resolved` を `true` に変更
- コメント自体は削除しない（履歴として残す）
- `layout` は `null` に設定して返す（自動レイアウトで再計算させる）
- `schemaVersion` は変更しない

---

## 8. テキストフローパーサー

### 8-1. `src/parser/text-flow-parser.ts`

現行スキルの「テキストフロー標準フォーマット」(text-flow-template.md) をパースし、FlowChartSchema に変換する。

```typescript
/**
 * テキストフロー（Markdown形式）をパースして FlowChartSchema を返す。
 * パースに失敗した場合は ParseError をスローする。
 */
export function parseTextFlow(markdown: string): FlowChartSchema;

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public context: string,
  ) {
    super(`Line ${line}: ${message}\n  Context: ${context}`);
  }
}
```

### 8-2. パース対象の記法

| 記法                     | パース結果                                    |
| ------------------------ | --------------------------------------------- |
| `## メタ情報` セクション | `meta` オブジェクト                           |
| `- フロー名:`            | `meta.name`                                   |
| `- 目的:`                | `meta.purpose`                                |
| `- 粒度:`                | `meta.granularity`                            |
| `- レーン:`              | `lanes` 配列 (スラッシュ区切り)               |
| `開始（...）`            | `nodes` に type="start" を追加                |
| `完了` / `終了`          | `nodes` に type="end" を追加                  |
| `↓`                      | 前後のノード間に type="normal" のエッジを追加 |
| `分岐①: ...`             | `nodes` に type="decision" を追加             |
| `No → ...`               | type="no" のエッジ + 短い枝ノードを追加       |
| `Yes↓`                   | type="yes" のエッジを追加                     |
| `【...】`                | サブフローのラベル（コメントとして処理）      |
| `（...）`                | sublabel に格納                               |
| `※ ...`                  | designNotes に追加                            |
| `## 設計判断メモ`        | `designNotes` 配列                            |
| `## 要確認事項`          | `openQuestions` 配列                          |

### 8-3. パースの基本アルゴリズム

```
1. 行単位で分割
2. ## セクション見出しでセクション分割
3. "## フロー構造" セクションを行ごとに処理:
   a. 「開始」→ start ノード生成
   b. 「↓」→ 前のノードから次のノードへの normal エッジ（保留）
   c. 「分岐①:」→ decision ノード生成
   d. インデント内の「No →」→ no エッジ + ターゲットノード
   e. 「Yes↓」→ yes エッジ（保留）
   f. 通常テキスト行 → process ノード生成
   g. 「完了」/「終了」→ end ノード生成
4. 保留エッジの source/target を確定
5. レーンの割り当て:
   - 【...】内のレーン情報から推定
   - 明示的でない場合、最初のレーンに配置
6. layout は null（自動レイアウト対象）
```

---

## 9. エクスポート

### 9-1. SVGエクスポート (`src/export/to-svg.ts`)

React Flow の `toObject()` と内部レンダリングから SVG を生成する。

```typescript
/**
 * 現在のフロー状態を SVG 文字列にエクスポートする。
 * React Flow の getNodes/getEdges から構築。
 * レーンヘッダー、Phase帯、凡例を含む。
 */
export function exportToSVG(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): string;
```

SVGの構造は現行スキルの template.md に準拠する:

- `<defs>` に矢印マーカー定義
- ノードは template.md §3 のパーツをそのまま使用
- エッジは template.md §4 の接続線パーツを使用
- 矢印ギャップ（+6px 始点, -14px 終点）を適用
- フォントは Noto Sans JP

### 9-2. HTMLエクスポート (`src/export/to-html.ts`)

現行スキルと完全互換のスタンドアロン HTML を生成する。

```typescript
export function exportToHTML(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): string;
```

HTML構造は template.md §1 のテンプレートをそのまま使用:

- Google Fonts の Noto Sans JP 読み込み
- CSS スタイル
- SVG 本体
- 凡例
- フロー概要・注記
- CONFIDENTIAL フッター

### 9-3. PNGエクスポート (`src/export/to-png.ts`)

SVGを Canvas に描画してPNGに変換。

```typescript
export async function exportToPNG(
  svgString: string,
  scale?: number, // デフォルト 2 (Retina対応)
): Promise<Blob>;
```

---

## 10. undo/redo

### 10-1. `useUndoRedo` フック (`src/editor/hooks/useUndoRedo.ts`)

```typescript
export function useUndoRedo<T>(
  initial: T,
  maxHistory?: number,
): {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};
```

- 履歴は FlowChartSchema のスナップショット配列
- maxHistory のデフォルト: 50
- JSON.stringify で深いコピー（パフォーマンスが問題になるまではこれで十分）

---

## 11. テスト仕様

### 11-1. レイアウトテスト (`tests/layout/sizing.test.ts`)

| テストケース                                   | 期待値                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 全角8文字 "費用負担パターン" の幅              | 8 _ 16 _ 1.05 = 134.4px                                                                   |
| 半角4文字 "test" の幅                          | 4 _ 16 _ 0.6 = 38.4px                                                                     |
| 混在 "管理画面でCSV" の幅                      | 全角4 _ 16 _ 1.05 + 半角3 _ 16 _ 0.6 = 67.2 + 28.8 = 96.0px                               |
| 矩形 "費用負担パターンを設定する" (全角11文字) | 幅 = max(11*16*1.05 + 48, 220) = max(232.8, 220) = 232.8 → 233px                          |
| ダイヤモンド "個人決済か" (全角5文字)          | W = max(ceil((5*16*1.05+48)/2*1.42), 110) = max(ceil(132*0.71), 110) = max(94, 110) = 110 |
| 楕円 "PF導入" (全角4文字)                      | rx = max(4*16*1.05/2\*1.2+24, 50) = max(64.5, 50) = 64.5 → 65                             |

### 11-2. パーサーテスト (`tests/parser/text-flow-parser.test.ts`)

text-flow-template.md の出力例（会計処理フロー）をパースして、正しいノード数・エッジ数・分岐数が得られることを検証する。

### 11-3. スキーマバリデーションテスト (`tests/schema/validate.test.ts`)

- 有効なスキーマが通ること
- 必須フィールドの欠落でエラーになること
- 存在しないレーンIDの参照でエラーになること
- エッジのsource/targetが存在しないノードIDの場合にエラーになること

---

## 12. 実装順序

Coding Agent は以下の順序で実装する。各ステップは前のステップが完了していることを前提とする。

### Step 1: プロジェクトセットアップ + 型定義

```
1. Vite + React + TypeScript プロジェクト作成
2. 依存パッケージインストール: @xyflow/react, elkjs, tailwindcss
3. src/types/schema.ts を本設計書 §1-1 からコピー
4. src/layout/constants.ts を本設計書 §2-2 からコピー
5. tsconfig.json で strict: true を確認
```

### Step 2: テキスト計算 + 図形サイズ

```
1. src/utils/text-measure.ts: isFullWidth, measureText
2. src/layout/sizing.ts: measureNodeText, calculateShapeSize, unifyWidthsInColumn
3. tests/layout/sizing.test.ts: §11-1 のテストケースを全て実装して通す
```

### Step 3: レイアウトエンジン

```
1. src/layout/engine.ts: calculateLayout (ELK統合)
2. 後処理: applyMergePoints, calculateLaneDividers
3. サンプルJSONで動作確認（コンソール出力でOK）
```

### Step 4: カスタムノード + エッジ

```
1. src/editor/nodes/ 全6種のカスタムノード
2. src/editor/edges/FlowEdge.tsx
3. それぞれのノードが正しく描画されることを目視確認
```

### Step 5: FlowEditor（基本）

```
1. src/editor/FlowEditor.tsx: React Flow キャンバス
2. src/editor/hooks/useFlowState.ts: Schema ⇄ React Flow 変換
3. src/editor/hooks/useAutoLayout.ts: ELK 実行
4. サンプルJSON読み込み → 自動レイアウト → 描画 の一気通貫を確認
```

### Step 6: オーバーレイ

```
1. src/editor/overlays/LaneOverlay.tsx
2. src/editor/overlays/PhaseOverlay.tsx
3. 添付スクリーンショットの見た目に近づけることを目標
```

### Step 7: GUI編集

```
1. ノードのドラッグ移動 → positions 更新
2. エッジの繋ぎ替え
3. テキストのインライン編集
4. 右クリックコンテキストメニュー
5. src/editor/hooks/useUndoRedo.ts
```

### Step 8: サイドバー + ツールバー

```
1. src/editor/Toolbar.tsx: ファイル操作、レイアウト
2. src/editor/Sidebar.tsx: プロパティ編集、コメント
3. JSON インポート/エクスポートの動作確認
```

### Step 9: コメント機構

```
1. src/editor/hooks/useComments.ts
2. src/editor/overlays/CommentBadge.tsx
3. サイドバーのComments タブ
4. コメント追加 → JSON保存 → 再読込 のサイクル確認
```

### Step 10: テキストフローパーサー

```
1. src/parser/text-flow-parser.ts
2. tests/parser/text-flow-parser.test.ts
3. テキストフロー入力 → JSON変換 → エディタ表示 のE2E確認
```

### Step 11: エクスポート

```
1. src/export/to-svg.ts
2. src/export/to-html.ts (現行スキル互換)
3. src/export/to-png.ts
4. 出力が現行スキルの品質と同等であることを確認
```

### Step 12: スキーマバリデーション

```
1. src/schema/validate.ts
2. tests/schema/validate.test.ts
3. 不正JSONの読み込み時にユーザーに適切なエラーメッセージを表示
```

---

## 13. サンプルデータ

### 13-1. 最小サンプル (`public/sample-flows/simple-flow.json`)

実装初期の動作確認用。

```json
{
  "schemaVersion": "1",
  "meta": {
    "name": "簡単な承認フロー",
    "purpose": "申請の承認が完了するまで",
    "granularity": "business",
    "version": "2026-03-13"
  },
  "lanes": [
    { "id": "lane-applicant", "label": "申請者", "order": 0 },
    { "id": "lane-approver", "label": "承認者", "order": 1 }
  ],
  "phases": [],
  "nodes": [
    {
      "id": "n1",
      "type": "start",
      "label": "申請開始",
      "sublabel": null,
      "lane": "lane-applicant",
      "phase": null,
      "style": "default",
      "comments": [],
      "decisionMeta": null,
      "referenceTargetId": null,
      "timeLabel": null
    },
    {
      "id": "n2",
      "type": "process",
      "label": "申請書を作成する",
      "sublabel": "申請システム",
      "lane": "lane-applicant",
      "phase": null,
      "style": "default",
      "comments": [],
      "decisionMeta": null,
      "referenceTargetId": null,
      "timeLabel": null
    },
    {
      "id": "n3",
      "type": "decision",
      "label": "内容に\n不備はないか",
      "sublabel": null,
      "lane": "lane-approver",
      "phase": null,
      "style": "default",
      "comments": [],
      "decisionMeta": {
        "branchNumber": 1,
        "yesDirection": "down",
        "noDirection": "right"
      },
      "referenceTargetId": null,
      "timeLabel": null
    },
    {
      "id": "n4",
      "type": "process",
      "label": "差し戻す",
      "sublabel": null,
      "lane": "lane-approver",
      "phase": null,
      "style": "orange",
      "comments": [],
      "decisionMeta": null,
      "referenceTargetId": null,
      "timeLabel": null
    },
    {
      "id": "n5",
      "type": "process",
      "label": "承認する",
      "sublabel": "申請システム",
      "lane": "lane-approver",
      "phase": null,
      "style": "default",
      "comments": [],
      "decisionMeta": null,
      "referenceTargetId": null,
      "timeLabel": null
    },
    {
      "id": "n6",
      "type": "end",
      "label": "完了",
      "sublabel": null,
      "lane": "lane-approver",
      "phase": null,
      "style": "default",
      "comments": [],
      "decisionMeta": null,
      "referenceTargetId": null,
      "timeLabel": null
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "type": "normal",
      "label": null,
      "comments": []
    },
    {
      "id": "e2",
      "source": "n2",
      "target": "n3",
      "type": "normal",
      "label": null,
      "comments": []
    },
    {
      "id": "e3",
      "source": "n3",
      "target": "n4",
      "type": "no",
      "label": "No",
      "comments": []
    },
    {
      "id": "e4",
      "source": "n3",
      "target": "n5",
      "type": "yes",
      "label": "Yes",
      "comments": []
    },
    {
      "id": "e5",
      "source": "n5",
      "target": "n6",
      "type": "normal",
      "label": null,
      "comments": []
    }
  ],
  "layout": null,
  "designNotes": [
    "分岐①を「内容に不備はないか」にした理由: 不備なし（Yes）が多数派のため正常系"
  ],
  "openQuestions": ["①差し戻し後の再申請フローが必要か"]
}
```

### 13-2. 添付画像再現用サンプル (`public/sample-flows/asis-flow.json`)

添付スクリーンショットの「AsIs 管理者と注文者の体験フロー」を再現する完全なJSON。Phase帯、2レーン、タイムラベルを含む。**Step 6 完了後にこのサンプルで目視検証する。**

（JSONは長大になるため、Coding Agent が添付スクリーンショットを参照して自力で作成すること。以下のノード一覧を参考にする。）

#### Phase A: 導入・登録（初回のみ）

| ノード  | type    | label                      | sublabel                   | lane   |
| ------- | ------- | -------------------------- | -------------------------- | ------ |
| n-start | start   | PF導入                     | -                          | 管理者 |
| n-a1    | process | 費用負担パターンを設定する | -                          | 管理者 |
| n-a2    | process | コード/QRを配布する        | -                          | 管理者 |
| n-a3    | process | ユーザー登録する           | -                          | 注文者 |
| n-a4    | process | 登録状況を確認・無効化する | 退職者アカウント無効化含む | 管理者 |

#### Phase B: 日次運用（時間軸で進行）

| ノード  | type    | label                     | sublabel                  | lane   | timeLabel    |
| ------- | ------- | ------------------------- | ------------------------- | ------ | ------------ |
| n-b1    | process | 休みカレンダーを設定する  | -                         | 管理者 | 2日以上前    |
| n-b2    | process | 事前予約する（仮押さえ）  | -                         | 注文者 | 2日以上前    |
| n-b3    | process | 注文状況を確認・照合する  | 注文一覧印刷→検品         | 管理者 | 前日         |
| n-b4    | process | 最終確認/前日締切品の確定 | -                         | 注文者 | 前日         |
| n-b5    | process | 当日注文/最終キャンセル   | 決済（該当時）            | 注文者 | 当日朝〜締切 |
| n-b6    | manual  | 変更・キャンセル          | PF不可→電話で玉子屋に連絡 | 注文者 | 締切後       |
| n-b7    | process | リマインド/通知を受け取る | -                         | 注文者 | -            |
| n-b-end | end     | 弁当受取り                | -                         | 注文者 | -            |

#### Phase C: 月次運用

| ノード | type    | label                    | sublabel | lane   |
| ------ | ------- | ------------------------ | -------- | ------ |
| n-c1   | process | 請求・利用実績を確認する | -        | 管理者 |
| n-c2   | process | 金額を照合する           | -        | 管理者 |
| n-c3   | process | 注文実績データを抽出する | -        | 管理者 |

（注文者側は「注文者の操作なし」のテキスト注釈のみ）

---

## 14. 非機能要件

| 項目                | 基準                      |
| ------------------- | ------------------------- |
| 初回レイアウト計算  | 50ノード以下で 500ms 以内 |
| GUI操作のレスポンス | ドラッグ中 60fps 維持     |
| JSONファイルサイズ  | 100ノードで 100KB 以下    |
| ブラウザ対応        | Chrome/Edge/Safari 最新版 |
| 日本語対応          | UI テキストは日本語       |

---

## 15. 将来拡張（本スコープ外だが設計時に考慮）

- **npm パッケージ化**: `ayatori` として公開
- **Claude Artifact 統合**: 単一 JSX ファイルへのバンドル
- **リアルタイム共同編集**: CRDT ベース (Yjs等)
- **バージョン管理**: schema の diff/merge
- **テキストフロー逆変換**: JSON → テキストフロー Markdown
