import { TEXT } from "../layout/constants.ts";

/**
 * 文字が全角かどうかを判定する。
 * Unicode の CJK統合漢字、ひらがな、カタカナ、全角記号を全角扱い。
 * ASCII、半角カタカナを半角扱い。
 */
export function isFullWidth(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;

  // U+3000-U+303F (CJK句読点)
  if (code >= 0x3000 && code <= 0x303f) return true;
  // U+3040-U+309F (ひらがな)
  if (code >= 0x3040 && code <= 0x309f) return true;
  // U+30A0-U+30FF (カタカナ)
  if (code >= 0x30a0 && code <= 0x30ff) return true;
  // U+4E00-U+9FFF (CJK統合漢字)
  if (code >= 0x4e00 && code <= 0x9fff) return true;
  // U+FF01-U+FF60 (全角ASCII)
  if (code >= 0xff01 && code <= 0xff60) return true;
  // U+FF65-U+FF9F (半角カタカナ) → 半角
  if (code >= 0xff65 && code <= 0xff9f) return false;

  return false;
}

export interface LineMetrics {
  text: string;
  fontSize: number;
  fullWidthCount: number;
  halfWidthCount: number;
  width: number;
  height: number;
}

export interface TextMetrics {
  lines: LineMetrics[];
  maxWidth: number;
  totalHeight: number;
}

function countChars(text: string): {
  fullWidthCount: number;
  halfWidthCount: number;
} {
  let fullWidthCount = 0;
  let halfWidthCount = 0;
  for (const char of text) {
    if (isFullWidth(char)) {
      fullWidthCount++;
    } else {
      halfWidthCount++;
    }
  }
  return { fullWidthCount, halfWidthCount };
}

function calculateLineWidth(
  fullWidthCount: number,
  halfWidthCount: number,
  fontSize: number,
): number {
  return (
    fullWidthCount * fontSize * TEXT.fullWidthRatio +
    halfWidthCount * fontSize * TEXT.halfWidthRatio
  );
}

function measureLine(text: string, fontSize: number): LineMetrics {
  const { fullWidthCount, halfWidthCount } = countChars(text);
  const width = calculateLineWidth(fullWidthCount, halfWidthCount, fontSize);
  const height = fontSize * TEXT.lineHeightRatio;
  return { text, fontSize, fullWidthCount, halfWidthCount, width, height };
}

const BREAK_PARTICLES = [
  "の",
  "は",
  "が",
  "を",
  "に",
  "へ",
  "で",
  "と",
  "も",
  "や",
  "か",
];

/**
 * テキストを適切な位置で改行する。
 * 改行の優先切れ目: 助詞の直後 → 読点の直後 → 括弧の直前 → スラッシュの前後
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (text.includes("\n")) {
    return text.split("\n");
  }

  const { fullWidthCount, halfWidthCount } = countChars(text);
  const textWidth = calculateLineWidth(fullWidthCount, halfWidthCount, fontSize);

  if (textWidth <= maxWidth) {
    return [text];
  }

  // Find the best break point
  let bestBreak = -1;
  let bestPriority = 999;

  const chars = [...text];
  for (let i = 1; i < chars.length; i++) {
    const leftText = chars.slice(0, i).join("");
    const leftCounts = countChars(leftText);
    const leftWidth = calculateLineWidth(
      leftCounts.fullWidthCount,
      leftCounts.halfWidthCount,
      fontSize,
    );

    if (leftWidth > maxWidth) break;

    let priority = 999;

    // Priority 1: 助詞の直後
    if (BREAK_PARTICLES.includes(chars[i - 1])) {
      priority = 1;
    }
    // Priority 2: 読点の直後
    else if (chars[i - 1] === "、" || chars[i - 1] === "，") {
      priority = 2;
    }
    // Priority 3: 括弧の直前
    else if (chars[i] === "（" || chars[i] === "(") {
      priority = 3;
    }
    // Priority 4: スラッシュの前後
    else if (chars[i] === "/" || chars[i - 1] === "/") {
      priority = 4;
    }

    if (priority < bestPriority) {
      bestPriority = priority;
      bestBreak = i;
    } else if (priority === bestPriority && priority < 999) {
      bestBreak = i;
    }
  }

  if (bestBreak === -1) {
    // No good break point found; break at the last position that fits
    for (let i = chars.length - 1; i > 0; i--) {
      const leftText = chars.slice(0, i).join("");
      const leftCounts = countChars(leftText);
      const leftWidth = calculateLineWidth(
        leftCounts.fullWidthCount,
        leftCounts.halfWidthCount,
        fontSize,
      );
      if (leftWidth <= maxWidth) {
        bestBreak = i;
        break;
      }
    }
  }

  if (bestBreak === -1) bestBreak = 1;

  const line1 = chars.slice(0, bestBreak).join("");
  const rest = chars.slice(bestBreak).join("");

  const restLines = wrapText(rest, fontSize, maxWidth);
  return [line1, ...restLines];
}

export function measureText(
  text: string,
  fontSize: number,
  maxWidth?: number,
): TextMetrics {
  const lines: string[] =
    maxWidth !== undefined ? wrapText(text, fontSize, maxWidth) : text.split("\n");

  const lineMetrics = lines.map((line) => measureLine(line, fontSize));
  const maxW = Math.max(...lineMetrics.map((l) => l.width), 0);
  const totalH = lineMetrics.reduce((sum, l) => sum + l.height, 0);

  return {
    lines: lineMetrics,
    maxWidth: maxW,
    totalHeight: totalH,
  };
}
