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
  rectShort: { width: 100, height: 36 },
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
  arrow: {
    default: "#222",
    loop: "#888",
    orange: "#c87800",
    green: "#2a7a2a",
  },
} as const;
