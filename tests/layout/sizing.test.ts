import { describe, it, expect } from "vitest";
import { isFullWidth, measureText } from "../../src/utils/text-measure.ts";
import {
  measureNodeText,
  calculateShapeSize,
} from "../../src/layout/sizing.ts";

describe("isFullWidth", () => {
  it("漢字は全角", () => {
    expect(isFullWidth("費")).toBe(true);
    expect(isFullWidth("用")).toBe(true);
  });

  it("ひらがなは全角", () => {
    expect(isFullWidth("の")).toBe(true);
    expect(isFullWidth("は")).toBe(true);
  });

  it("カタカナは全角", () => {
    expect(isFullWidth("パ")).toBe(true);
    expect(isFullWidth("タ")).toBe(true);
  });

  it("ASCII文字は半角", () => {
    expect(isFullWidth("t")).toBe(false);
    expect(isFullWidth("A")).toBe(false);
    expect(isFullWidth("1")).toBe(false);
  });

  it("半角カタカナは半角", () => {
    expect(isFullWidth("ｱ")).toBe(false);
  });
});

describe("テキスト幅計算", () => {
  it("全角8文字 '費用負担パターン' の幅", () => {
    const metrics = measureText("費用負担パターン", 16);
    // 8 * 16 * 1.05 = 134.4px
    expect(metrics.maxWidth).toBeCloseTo(134.4, 1);
  });

  it("半角4文字 'test' の幅", () => {
    const metrics = measureText("test", 16);
    // 4 * 16 * 0.6 = 38.4px
    expect(metrics.maxWidth).toBeCloseTo(38.4, 1);
  });

  it("混在 '管理画面でCSV' の幅", () => {
    const metrics = measureText("管理画面でCSV", 16);
    // 全角4("管理画面") + 全角1("で") = 5全角, 半角3("CSV") = 3半角
    // Wait: 管理画面で = 5全角文字, CSV = 3半角文字
    // 5 * 16 * 1.05 + 3 * 16 * 0.6 = 84 + 28.8 = 112.8
    // But the SPEC says: "管理画面でCSV" = 全角4 * 16 * 1.05 + 半角3 * 16 * 0.6 = 67.2 + 28.8 = 96.0
    // Let me recount: 管(全) 理(全) 画(全) 面(全) で(全) C(半) S(半) V(半)
    // That's 5 full-width + 3 half-width = 5*16*1.05 + 3*16*0.6 = 84 + 28.8 = 112.8
    // The SPEC's test case says "全角4" which might be different text. Let me just check actual count.
    // Actually the spec says: "混在 "管理画面でCSV" の幅 | 全角4 * 16 * 1.05 + 半角3 * 16 * 0.6 = 67.2 + 28.8 = 96.0px"
    // So "管理画面" = 4 full-width, "で" is counted... hmm. Let me check if で is full-width:
    // で is U+3067 (ひらがな) → full-width. So 管理画面で = 5 full-width.
    // Maybe the SPEC has a typo. Let me trust our implementation and test actual values.
    // 管(全) 理(全) 画(全) 面(全) で(全) C(半) S(半) V(半) = 5全角 + 3半角
    expect(metrics.maxWidth).toBeCloseTo(5 * 16 * 1.05 + 3 * 16 * 0.6, 1);
  });
});

describe("図形サイズ計算", () => {
  it("矩形 '費用負担パターンを設定する' (全角13文字)", () => {
    const metrics = measureNodeText("費用負担パターンを設定する", null, "process");
    const size = calculateShapeSize(metrics, "process");
    // 費用負担パターンを設定する = 13全角文字
    // 幅 = max(13*16*1.05 + 48, 220) = max(218.4+48, 220) = max(266.4, 220) = 266.4
    expect(size.width).toBeCloseTo(266.4, 0);
    expect(size.width).toBeGreaterThanOrEqual(220);
  });

  it("ダイヤモンド '個人決済か' (全角5文字)", () => {
    const metrics = measureNodeText("個人決済か", null, "decision");
    const size = calculateShapeSize(metrics, "decision");
    // innerW = 5*16*1.05 + 48 = 84+48 = 132
    // W = max(ceil(132/2 * 1.42), 110) = max(ceil(93.72), 110) = max(94, 110) = 110
    expect(size.width).toBe(110);
  });

  it("楕円 'PF導入' (全角2+半角2)", () => {
    const metrics = measureNodeText("PF導入", null, "start");
    const size = calculateShapeSize(metrics, "start");
    // P(半) F(半) 導(全) 入(全) → 2半角 + 2全角
    // textWidth = 2*16*0.6 + 2*16*1.05 = 19.2 + 33.6 = 52.8
    // rx = max(52.8/2 * 1.2 + 24, 50) = max(31.68 + 24, 50) = max(55.68, 50) = 55.68
    expect(size.width).toBeCloseTo(55.68, 0);
  });
});
