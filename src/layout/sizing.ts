import type { NodeType } from "../types/schema.ts";
import type { TextMetrics } from "../utils/text-measure.ts";
import { measureText } from "../utils/text-measure.ts";
import { FONT, TEXT, MIN_SIZE, DIAMOND, ELLIPSE, WIDTH_UNIFY } from "./constants.ts";

export interface ShapeSize {
  /** 矩形の場合: 幅。ダイヤモンドの場合: W（中心からの水平距離）。楕円の場合: rx */
  width: number;
  /** 矩形の場合: 高さ。ダイヤモンドの場合: H（中心からの垂直距離）。楕円の場合: ry */
  height: number;
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
): TextMetrics {
  const mainFontSize = FONT.nodeMain.size;
  const subFontSize = FONT.nodeSub.size;

  let maxContentWidth: number | undefined;
  if (nodeType === "decision") {
    maxContentWidth =
      DIAMOND.maxCharsPerLine * mainFontSize * TEXT.fullWidthRatio;
  }

  const mainMetrics = measureText(label, mainFontSize, maxContentWidth);

  if (sublabel) {
    const subMetrics = measureText(sublabel, subFontSize, maxContentWidth);
    return {
      lines: [...mainMetrics.lines, ...subMetrics.lines],
      maxWidth: Math.max(mainMetrics.maxWidth, subMetrics.maxWidth),
      totalHeight: mainMetrics.totalHeight + subMetrics.totalHeight,
    };
  }

  return mainMetrics;
}

/**
 * テキストメトリクスからノードの図形サイズを計算する。
 * 最小サイズを適用する。
 */
export function calculateShapeSize(
  metrics: TextMetrics,
  nodeType: NodeType,
  isShortBranch = false,
): ShapeSize {
  const paddingX2 = TEXT.paddingX * 2; // 48
  const paddingY2 = TEXT.paddingY * 2; // 20

  if (nodeType === "decision") {
    const innerW = metrics.maxWidth + paddingX2;
    const innerH = metrics.totalHeight + paddingY2;
    const W = Math.max(
      Math.ceil((innerW / 2) * DIAMOND.scaleFactor),
      MIN_SIZE.diamond.W,
    );
    const H = Math.max(
      Math.ceil((innerH / 2) * DIAMOND.scaleFactor),
      MIN_SIZE.diamond.H,
    );
    return { width: W, height: H };
  }

  if (nodeType === "start" || nodeType === "end") {
    const rx = Math.max(
      metrics.maxWidth / 2 * ELLIPSE.rxScale + TEXT.paddingX,
      MIN_SIZE.ellipse.rx,
    );
    const ry = Math.max(
      metrics.totalHeight / 2 + TEXT.paddingY,
      MIN_SIZE.ellipse.ry,
    );
    return { width: rx, height: ry };
  }

  // 矩形系: process
  const minSize = isShortBranch ? MIN_SIZE.rectShort : MIN_SIZE.rect;
  const width = Math.max(metrics.maxWidth + paddingX2, minSize.width);
  const height = Math.max(metrics.totalHeight + paddingY2, minSize.height);
  return { width, height };
}

/**
 * 同一列内の矩形幅を最大値に統一する。
 * ただし最大値との差が WIDTH_UNIFY.threshold 以上の矩形は個別幅を維持。
 * ダイヤモンドは統一対象外。
 */
export function unifyWidthsInColumn(
  sizes: Map<string, ShapeSize>,
  columnNodes: string[],
  nodeTypes: Map<string, NodeType>,
): void {
  const rectNodes = columnNodes.filter((id) => {
    const type = nodeTypes.get(id);
    return type !== "decision" && type !== "start" && type !== "end";
  });

  if (rectNodes.length === 0) return;

  const maxWidth = Math.max(
    ...rectNodes.map((id) => sizes.get(id)!.width),
  );

  for (const id of rectNodes) {
    const size = sizes.get(id)!;
    if (maxWidth - size.width < WIDTH_UNIFY.threshold) {
      size.width = maxWidth;
    }
  }
}
