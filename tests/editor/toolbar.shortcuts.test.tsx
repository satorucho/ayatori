import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toolbar from "../../src/editor/Toolbar.tsx";

describe("Toolbar keyboard shortcuts", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const anchorClickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  afterEach(() => {
    anchorClickSpy.mockClear();
  });

  it("Ctrl/Cmd+S でJSON保存が実行される", () => {
    const onExportJSON = vi.fn(() => '{"schemaVersion":"1"}');
    const onNotify = vi.fn();

    render(
      <Toolbar
        onAutoLayout={async () => {}}
        onExportJSON={onExportJSON}
        onImportJSON={() => ({ ok: true as const })}
        onNotify={onNotify}
      />,
    );

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(onExportJSON).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith({
      type: "success",
      message: "JSONを保存しました",
    });
  });

  it("Ctrl/Cmd+L で自動レイアウトが実行される（フリードローON時）", async () => {
    const onAutoLayout = vi.fn(async () => {});
    const onNotify = vi.fn();

    render(
      <Toolbar
        onAutoLayout={onAutoLayout}
        onExportJSON={() => '{"schemaVersion":"1"}'}
        onImportJSON={() => ({ ok: true as const })}
        freeDrawMode
        onNotify={onNotify}
      />,
    );

    fireEvent.keyDown(window, { key: "l", ctrlKey: true });

    await waitFor(() => {
      expect(onAutoLayout).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith({
        type: "success",
        message: "自動レイアウトを実行しました",
      });
    });
  });

  it("Ctrl/Cmd+B でサイドバーを開閉できる", () => {
    const onToggleSidebar = vi.fn();

    render(
      <Toolbar
        onAutoLayout={async () => {}}
        onExportJSON={() => '{"schemaVersion":"1"}'}
        onImportJSON={() => ({ ok: true as const })}
        onToggleSidebar={onToggleSidebar}
      />,
    );

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });
});

