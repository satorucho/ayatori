import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toolbar from "../../src/editor/Toolbar.tsx";

describe("Toolbar import validation feedback", () => {
  const OriginalFileReader = global.FileReader;

  class MockFileReader {
    public result: string | null = null;
    public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsText() {
      this.result = '{"invalid":true}';
      this.onload?.({} as ProgressEvent<FileReader>);
    }
  }

  beforeEach(() => {
    // @ts-expect-error test mock
    global.FileReader = MockFileReader;
  });

  afterEach(() => {
    cleanup();
    global.FileReader = OriginalFileReader;
    vi.clearAllMocks();
  });

  it("不正ファイル時にエラー通知を出す", async () => {
    const onImportJSON = vi.fn(() => ({
      ok: false as const,
      error: "スキーマ検証に失敗しました",
    }));
    const onNotify = vi.fn();

    const { container } = render(
      <Toolbar
        onAutoLayout={async () => {}}
        onExportJSON={() => "{}"}
        onImportJSON={onImportJSON}
        onNotify={onNotify}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"invalid":true}'], "invalid.json", {
      type: "application/json",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onImportJSON).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith({
        type: "error",
        message: "スキーマ検証に失敗しました",
      });
    });
  });

  it("正常ファイル時に成功通知を出す", async () => {
    const onImportJSON = vi.fn(() => ({ ok: true as const }));
    const onNotify = vi.fn();

    const { container } = render(
      <Toolbar
        onAutoLayout={async () => {}}
        onExportJSON={() => "{}"}
        onImportJSON={onImportJSON}
        onNotify={onNotify}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"schemaVersion":"1"}'], "valid.json", {
      type: "application/json",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onImportJSON).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith({
        type: "success",
        message: "ファイルを読み込みました",
      });
    });
  });
});

