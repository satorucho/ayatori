import { useCallback, useRef, useState } from "react";
import { parseTextFlow } from "../parser/text-flow-parser.ts";
import type { NodeType } from "../types/schema.ts";

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: "process", label: "処理" },
  { value: "decision", label: "分岐" },
  { value: "start", label: "開始" },
  { value: "end", label: "終了" },
  { value: "data", label: "データ" },
  { value: "manual", label: "手動処理" },
  { value: "reference", label: "参照" },
];

interface ToolbarProps {
  onAutoLayout: () => Promise<void>;
  onExportJSON: () => string;
  onImportJSON: (json: string) => void;
  onExportSVG?: () => void;
  onExportHTML?: () => void;
  onExportPNG?: () => void;
  onAddNode?: (type: NodeType) => void;
}

export default function Toolbar({
  onAutoLayout,
  onExportJSON,
  onImportJSON,
  onExportSVG,
  onExportHTML,
  onExportPNG,
  onAddNode,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textFlowDialogOpen, setTextFlowDialogOpen] = useState(false);
  const [textFlowInput, setTextFlowInput] = useState("");
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const addNodeRef = useRef<HTMLDivElement>(null);

  const handleOpenJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onImportJSON(reader.result as string);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImportJSON],
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
  }, [onExportJSON]);

  const handleTextFlowImport = useCallback(() => {
    if (!textFlowInput.trim()) return;
    try {
      const schema = parseTextFlow(textFlowInput);
      onImportJSON(JSON.stringify(schema));
      setTextFlowDialogOpen(false);
      setTextFlowInput("");
    } catch (err) {
      alert(`パースエラー: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  }, [textFlowInput, onImportJSON]);

  const btnClass =
    "px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 active:bg-gray-100 transition-colors whitespace-nowrap";

  return (
    <>
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2 shrink-0">
        <span className="font-bold text-lg mr-4 text-gray-800">Ayatori</span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
        <button onClick={handleOpenJSON} className={btnClass}>
          JSONを開く
        </button>
        <button onClick={handleSaveJSON} className={btnClass}>
          JSONを保存
        </button>
        <button
          onClick={() => setTextFlowDialogOpen(true)}
          className={btnClass}
        >
          テキストフロー読込
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button onClick={onAutoLayout} className={btnClass}>
          自動レイアウト
        </button>

        {onAddNode && (
          <div className="relative" ref={addNodeRef}>
            <button
              onClick={() => setAddNodeOpen((v) => !v)}
              className={btnClass}
            >
              ＋ ノード追加
            </button>
            {addNodeOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[140px] py-1">
                {NODE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      onAddNode(opt.value);
                      setAddNodeOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {onExportSVG && (
          <button onClick={onExportSVG} className={btnClass}>
            SVG
          </button>
        )}
        {onExportHTML && (
          <button onClick={onExportHTML} className={btnClass}>
            HTML
          </button>
        )}
        {onExportPNG && (
          <button onClick={onExportPNG} className={btnClass}>
            PNG
          </button>
        )}

        <div className="flex-1" />

        <span className="text-xs text-gray-400">v0.1.0</span>
      </div>

      {textFlowDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                テキストフローを読み込む
              </h2>
              <button
                onClick={() => setTextFlowDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <textarea
                className="w-full h-64 p-3 border border-gray-300 rounded text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`## メタ情報\n- フロー名: ...\n- 目的: ...\n- 粒度: 業務担当・PM向け\n- レーン: 担当者A/担当者B\n\n## フロー構造\n\n開始（...）\n↓\n処理ステップ\n↓\n完了`}
                value={textFlowInput}
                onChange={(e) => setTextFlowInput(e.target.value)}
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setTextFlowDialogOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleTextFlowImport}
                disabled={!textFlowInput.trim()}
                className="px-4 py-2 text-sm text-white bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                読み込む
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
