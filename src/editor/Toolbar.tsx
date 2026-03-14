import { useCallback, useRef, useState, useEffect } from "react";
import type { NodeType } from "../types/schema.ts";
import { useTheme } from "../theme/useTheme.ts";
import { Switch } from "../components/ui/Switch.tsx";

interface ToolbarProps {
  onAutoLayout: () => Promise<void>;
  onExportJSON: () => string;
  onExportYAML?: () => string;
  onImportJSON: (json: string) => { ok: true } | { ok: false; error: string };
  onExportSVG?: () => void;
  onExportHTML?: () => void;
  onExportPNG?: () => void;
  onAddNode?: (type: NodeType) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  freeDrawMode?: boolean;
  onToggleFreeDrawMode?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onAddLane?: () => void;
  onAddPhase?: () => void;
  onNotify?: (notice: { type: "success" | "error"; message: string }) => void;
}

type MenuItem =
  | {
      type: "action";
      label: string;
      shortcut?: string;
      onClick: () => void;
      disabled?: boolean;
    }
  | { type: "divider" };

function AyatoriIcon() {
  return (
    <img
      src="/logo.svg"
      alt="Ayatori"
      width={22}
      height={22}
      className="shrink-0 dark:invert"
    />
  );
}

function DropdownMenu({
  label,
  items,
  isOpen,
  onToggle,
  onHover,
}: {
  label: string;
  items: MenuItem[];
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        onMouseEnter={onHover}
        className={`px-2.5 py-1 text-[13px] rounded transition-colors ${
          isOpen
            ? "bg-black/10 dark:bg-white/15"
            : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
      >
        {label}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-px bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-600/80 rounded-lg shadow-lg shadow-black/10 z-50 min-w-[220px] py-1">
          {items.map((item, i) => {
            if (item.type === "divider") {
              return (
                <div
                  key={i}
                  className="my-1 mx-2 h-px bg-gray-200 dark:bg-gray-600"
                />
              );
            }
            return (
              <button
                key={i}
                disabled={item.disabled}
                className="w-full text-left px-3 py-[5px] text-[13px] leading-tight flex items-center justify-between rounded-[4px] mx-0 hover:bg-blue-500 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-current transition-colors group"
                onClick={item.onClick}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-8 text-[11px] text-gray-400 dark:text-gray-500 tracking-wide group-hover:text-white/70 group-disabled:group-hover:text-gray-400">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  onAutoLayout,
  onExportJSON,
  onExportYAML,
  onImportJSON,
  onExportSVG,
  onExportHTML,
  onExportPNG,
  onAddNode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  freeDrawMode,
  onToggleFreeDrawMode,
  sidebarOpen,
  onToggleSidebar,
  onAddLane,
  onAddPhase,
  onNotify,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      const toolbar = document.getElementById("ayatori-menubar");
      if (toolbar && !toolbar.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = onImportJSON(reader.result as string);
        if (!result.ok) {
          onNotify?.({ type: "error", message: result.error });
          return;
        }
        onNotify?.({ type: "success", message: "ファイルを読み込みました" });
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImportJSON, onNotify],
  );

  const handleSaveJSON = useCallback(() => {
    const json = onExportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchart.json";
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.({ type: "success", message: "JSONを保存しました" });
  }, [onExportJSON, onNotify]);

  const handleSaveYAML = useCallback(() => {
    if (!onExportYAML) return;
    const yaml = onExportYAML();
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchart.yaml";
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.({ type: "success", message: "YAMLを保存しました" });
  }, [onExportYAML, onNotify]);

  const close = useCallback(() => setOpenMenu(null), []);

  const runAutoLayoutWithNotice = useCallback(() => {
    void onAutoLayout()
      .then(() => {
        onNotify?.({ type: "success", message: "自動レイアウトを実行しました" });
      })
      .catch((err) => {
        onNotify?.({
          type: "error",
          message: `自動レイアウトに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
  }, [onAutoLayout, onNotify]);

  const toggle = useCallback(
    (name: string) => setOpenMenu((prev) => (prev === name ? null : name)),
    [],
  );

  const hoverSwitch = useCallback(
    (name: string) => {
      setOpenMenu((prev) => (prev !== null && prev !== name ? name : prev));
    },
    [],
  );

  const fileItems: MenuItem[] = [
    {
      type: "action",
      label: "ファイルを開く…",
      shortcut: "⌘O",
      onClick: () => {
        fileInputRef.current?.click();
        close();
      },
    },
    { type: "divider" },
    {
      type: "action",
      label: "JSONで保存",
      shortcut: "⌘S",
      onClick: () => {
        handleSaveJSON();
        close();
      },
    },
    ...(onExportYAML
      ? [
          {
            type: "action" as const,
            label: "YAMLで保存（コンパクト）",
            shortcut: "⌘⇧S",
            onClick: () => {
              handleSaveYAML();
              close();
            },
          },
        ]
      : []),
    { type: "divider" },
    ...(onExportSVG
      ? [
          {
            type: "action" as const,
            label: "SVGで書き出し",
            onClick: () => {
              onExportSVG();
                onNotify?.({ type: "success", message: "SVGを書き出しました" });
              close();
            },
          },
        ]
      : []),
    ...(onExportHTML
      ? [
          {
            type: "action" as const,
            label: "HTMLで書き出し",
            onClick: () => {
              onExportHTML();
                onNotify?.({ type: "success", message: "HTMLを書き出しました" });
              close();
            },
          },
        ]
      : []),
    ...(onExportPNG
      ? [
          {
            type: "action" as const,
            label: "PNGで書き出し",
            onClick: () => {
              onExportPNG();
                onNotify?.({ type: "success", message: "PNGを書き出しました" });
              close();
            },
          },
        ]
      : []),
  ];

  const editItems: MenuItem[] = [
    ...(onUndo
      ? [
          {
            type: "action" as const,
            label: "元に戻す",
            shortcut: "⌘Z",
            disabled: !canUndo,
            onClick: () => {
              onUndo();
              close();
            },
          },
        ]
      : []),
    ...(onRedo
      ? [
          {
            type: "action" as const,
            label: "やり直し",
            shortcut: "⌘⇧Z",
            disabled: !canRedo,
            onClick: () => {
              onRedo();
              close();
            },
          },
        ]
      : []),
    { type: "divider" },
    {
      type: "action",
      label: "自動レイアウト",
      shortcut: "⌘L",
      disabled: !freeDrawMode,
      onClick: () => {
        runAutoLayoutWithNotice();
        close();
      },
    },
    { type: "divider" },
    ...(onToggleFreeDrawMode
      ? [
          {
            type: "action" as const,
            label: freeDrawMode
              ? "\u2713 フリードロー"
              : "\u2003 フリードロー",
            onClick: () => {
              onToggleFreeDrawMode();
              close();
            },
          },
        ]
      : []),
    ...(onAddLane || onAddPhase
      ? [
          { type: "divider" as const },
          ...(onAddLane
            ? [
                {
                  type: "action" as const,
                  label: "レーンを追加",
                  onClick: () => {
                    onAddLane();
                    close();
                  },
                },
              ]
            : []),
          ...(onAddPhase
            ? [
                {
                  type: "action" as const,
                  label: "フェーズを追加",
                  onClick: () => {
                    onAddPhase();
                    close();
                  },
                },
              ]
            : []),
        ]
      : []),
  ];

  const viewItems: MenuItem[] = [
    {
      type: "action",
      label: isDark ? "\u2713 ダークモード" : "\u2003 ダークモード",
      onClick: () => {
        toggleTheme();
        close();
      },
    },
  ];

  const insertItems: MenuItem[] = onAddNode
    ? [
        {
          type: "action",
          label: "処理ノード",
          onClick: () => {
            onAddNode("process");
            close();
          },
        },
        {
          type: "action",
          label: "分岐ノード",
          onClick: () => {
            onAddNode("decision");
            close();
          },
        },
        { type: "divider" },
        {
          type: "action",
          label: "開始",
          onClick: () => {
            onAddNode("start");
            close();
          },
        },
        {
          type: "action",
          label: "終了",
          onClick: () => {
            onAddNode("end");
            close();
          },
        },
        { type: "divider" },
        {
          type: "action",
          label: "データ",
          onClick: () => {
            onAddNode("data");
            close();
          },
        },
        {
          type: "action",
          label: "手動処理",
          onClick: () => {
            onAddNode("manual");
            close();
          },
        },
        {
          type: "action",
          label: "参照",
          onClick: () => {
            onAddNode("reference");
            close();
          },
        },
      ]
    : [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isInput) return;

      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (key === "s") {
        e.preventDefault();
        if (e.shiftKey && onExportYAML) {
          handleSaveYAML();
        } else {
          handleSaveJSON();
        }
        return;
      }
      if (key === "l") {
        e.preventDefault();
        if (freeDrawMode) {
          runAutoLayoutWithNotice();
        }
        return;
      }
      if (key === "b" && onToggleSidebar) {
        e.preventDefault();
        onToggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSaveJSON,
    handleSaveYAML,
    onExportYAML,
    freeDrawMode,
    onToggleSidebar,
    runAutoLayoutWithNotice,
  ]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        id="ayatori-menubar"
        className="h-9 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 flex items-center pl-2 pr-3 gap-0.5 shrink-0 select-none relative z-50 text-gray-800 dark:text-gray-200"
      >
        <div className="flex items-center px-1.5 mr-0.5">
          <AyatoriIcon />
        </div>

        <DropdownMenu
          label="ファイル"
          items={fileItems}
          isOpen={openMenu === "file"}
          onToggle={() => toggle("file")}
          onHover={() => hoverSwitch("file")}
        />
        <DropdownMenu
          label="編集"
          items={editItems}
          isOpen={openMenu === "edit"}
          onToggle={() => toggle("edit")}
          onHover={() => hoverSwitch("edit")}
        />
        <DropdownMenu
          label="表示"
          items={viewItems}
          isOpen={openMenu === "view"}
          onToggle={() => toggle("view")}
          onHover={() => hoverSwitch("view")}
        />
        {insertItems.length > 0 && (
          <DropdownMenu
            label="挿入"
            items={insertItems}
            isOpen={openMenu === "insert"}
            onToggle={() => toggle("insert")}
            onHover={() => hoverSwitch("insert")}
          />
        )}

        <div className="flex-1" />

        {onToggleFreeDrawMode && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              フリードロー
            </span>
            <Switch
              checked={!!freeDrawMode}
              onCheckedChange={() => onToggleFreeDrawMode()}
            />
          </label>
        )}

        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="13" y1="3" x2="13" y2="17" stroke="currentColor" strokeWidth="1.5" />
              {sidebarOpen && (
                <>
                  <line x1="15" y1="7" x2="16.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="15" y1="10" x2="16.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="15" y1="13" x2="16.5" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      {openMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenu(null)}
        />
      )}
    </>
  );
}
