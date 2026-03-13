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
  | "start"
  | "end"
  | "process"
  | "decision"
  | "data"
  | "manual"
  | "reference";

/** ノードのスタイルバリアント */
export type NodeStyle =
  | "default"
  | "gray"
  | "orange"
  | "green"
  | "blue-ref"
  | "hypothesis";

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
   */
  yesDirection: "down" | "right";
  noDirection: "down" | "right";
}

// ---- Edge ----

/** エッジの種別 */
export type EdgeType =
  | "normal"
  | "yes"
  | "no"
  | "loop"
  | "hypothesis"
  | "merge";

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
