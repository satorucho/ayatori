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

  it("Ctrl/Cmd+S でYAML保存が実行される", () => {
    const onExportYAML = vi.fn(() => "schemaVersion: '1'\n");
    const onNotify = vi.fn();

    render(
      <Toolbar
        onAutoLayout={async () => {}}
        onExportYAML={onExportYAML}
        onImportSchema={() => ({ ok: true as const })}
        onNotify={onNotify}
      />,
    );

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(onExportYAML).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith({
      type: "success",
      message: "YAMLを保存しました",
    });
  });

  it("Ctrl/Cmd+L で自動レイアウトが実行される（フリードローON時）", async () => {
    const onAutoLayout = vi.fn(async () => {});
    const onNotify = vi.fn();

    render(
      <Toolbar
        onAutoLayout={onAutoLayout}
        onExportYAML={() => "schemaVersion: '1'\n"}
        onImportSchema={() => ({ ok: true as const })}
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
        onExportYAML={() => "schemaVersion: '1'\n"}
        onImportSchema={() => ({ ok: true as const })}
        onToggleSidebar={onToggleSidebar}
      />,
    );

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });
});
