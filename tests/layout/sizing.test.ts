import { describe, it, expect } from "vitest";
import { isFullWidth, measureText } from "../../src/utils/text-measure.ts";
import {
  measureNodeText,
  calculateShapeSize,
} from "../../src/layout/sizing.ts";
import { FONT } from "../../src/layout/constants.ts";

const mainFS = FONT.nodeMain.size;

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
    const metrics = measureText("費用負担パターン", mainFS);
    expect(metrics.maxWidth).toBeCloseTo(8 * mainFS * 1.05, 1);
  });

  it("半角4文字 'test' の幅", () => {
    const metrics = measureText("test", mainFS);
    expect(metrics.maxWidth).toBeCloseTo(4 * mainFS * 0.6, 1);
  });

  it("混在 '管理画面でCSV' の幅", () => {
    const metrics = measureText("管理画面でCSV", mainFS);
    // 管(全) 理(全) 画(全) 面(全) で(全) C(半) S(半) V(半) = 5全角 + 3半角
    expect(metrics.maxWidth).toBeCloseTo(5 * mainFS * 1.05 + 3 * mainFS * 0.6, 1);
  });
});

describe("図形サイズ計算", () => {
  it("矩形 '費用負担パターンを設定する' (全角13文字)", () => {
    const metrics = measureNodeText("費用負担パターンを設定する", null, "process");
    const size = calculateShapeSize(metrics, "process");
    const expectedWidth = 13 * mainFS * 1.05 + 48;
    expect(size.width).toBeCloseTo(Math.max(expectedWidth, 220), 0);
    expect(size.width).toBeGreaterThanOrEqual(220);
  });

  it("ダイヤモンド '個人決済か' (全角5文字)", () => {
    const metrics = measureNodeText("個人決済か", null, "decision");
    const size = calculateShapeSize(metrics, "decision");
    const innerW = 5 * mainFS * 1.05 + 48;
    const W = Math.max(Math.ceil((innerW / 2) * 1.42), 110);
    expect(size.width).toBe(W);
  });

  it("楕円 'PF導入' (全角2+半角2)", () => {
    const metrics = measureNodeText("PF導入", null, "start");
    const size = calculateShapeSize(metrics, "start");
    const textWidth = 2 * mainFS * 0.6 + 2 * mainFS * 1.05;
    const expectedRx = Math.max(textWidth / 2 * 1.2 + 24, 50);
    expect(size.width).toBeCloseTo(expectedRx, 0);
  });
});
