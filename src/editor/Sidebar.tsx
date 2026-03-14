import { useState, useCallback, useRef, useEffect } from "react";
import type {
  FlowChartSchema,
  FlowNode,
  FlowEdge,
  FlowMeta,
  NodeType,
  NodeStyle,
  EdgeType,
} from "../types/schema.ts";
import { generateId } from "../utils/id.ts";

interface SidebarProps {
  schema: FlowChartSchema;
  updateSchema: (updater: (prev: FlowChartSchema) => FlowChartSchema) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: "start", label: "開始" },
  { value: "end", label: "終了" },
  { value: "process", label: "処理" },
  { value: "decision", label: "分岐" },
  { value: "data", label: "データ" },
  { value: "manual", label: "手作業" },
  { value: "reference", label: "参照" },
];

const NODE_STYLES: { value: NodeStyle; label: string }[] = [
  { value: "default", label: "標準" },
  { value: "gray", label: "グレー" },
  { value: "orange", label: "オレンジ" },
  { value: "green", label: "グリーン" },
  { value: "blue-ref", label: "ブルー(参照)" },
  { value: "hypothesis", label: "仮説(点線)" },
];

const EDGE_TYPES: { value: EdgeType; label: string }[] = [
  { value: "normal", label: "通常" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "loop", label: "ループ" },
  { value: "hypothesis", label: "仮説" },
  { value: "merge", label: "合流" },
];

type TabId = "properties" | "comments";

export default function Sidebar({
  schema,
  updateSchema,
  selectedNodeId,
  selectedEdgeId,
}: SidebarProps) {
  const [tab, setTab] = useState<TabId>("properties");

  const selectedNode = selectedNodeId
    ? (schema.nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;
  const selectedEdge = selectedEdgeId
    ? (schema.edges.find((e) => e.id === selectedEdgeId) ?? null)
    : null;

  const updateNode = useCallback(
    (nodeId: string, partial: Partial<FlowNode>) => {
      updateSchema((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...partial } : n,
        ),
      }));
    },
    [updateSchema],
  );

  const updateEdge = useCallback(
    (edgeId: string, partial: Partial<FlowEdge>) => {
      updateSchema((prev) => ({
        ...prev,
        edges: prev.edges.map((e) =>
          e.id === edgeId ? { ...e, ...partial } : e,
        ),
      }));
    },
    [updateSchema],
  );

  const addComment = useCallback(
    (targetType: "node" | "edge", targetId: string, text: string) => {
      const comment = {
        id: generateId("comment"),
        author: "user" as const,
        text,
        resolved: false,
        createdAt: new Date().toISOString(),
      };

      if (targetType === "node") {
        updateSchema((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === targetId
              ? { ...n, comments: [...n.comments, comment] }
              : n,
          ),
        }));
      } else {
        updateSchema((prev) => ({
          ...prev,
          edges: prev.edges.map((e) =>
            e.id === targetId
              ? { ...e, comments: [...e.comments, comment] }
              : e,
          ),
        }));
      }
    },
    [updateSchema],
  );

  const resolveComment = useCallback(
    (targetType: "node" | "edge", targetId: string, commentId: string) => {
      if (targetType === "node") {
        updateSchema((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === targetId
              ? {
                  ...n,
                  comments: n.comments.map((c) =>
                    c.id === commentId ? { ...c, resolved: true } : c,
                  ),
                }
              : n,
          ),
        }));
      } else {
        updateSchema((prev) => ({
          ...prev,
          edges: prev.edges.map((e) =>
            e.id === targetId
              ? {
                  ...e,
                  comments: e.comments.map((c) =>
                    c.id === commentId ? { ...c, resolved: true } : c,
                  ),
                }
              : e,
          ),
        }));
      }
    },
    [updateSchema],
  );

  const inputClass =
    "w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200";
  const selectClass =
    "w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200";
  const labelClass =
    "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "properties" ? "text-gray-900 dark:text-gray-100 border-b-2 border-gray-900 dark:border-gray-100" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
          onClick={() => setTab("properties")}
        >
          プロパティ
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "comments" ? "text-gray-900 dark:text-gray-100 border-b-2 border-gray-900 dark:border-gray-100" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
          onClick={() => setTab("comments")}
        >
          コメント
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === "properties" && (
          <>
            {selectedNode && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  ノード: {selectedNode.id}
                </h3>
                <div>
                  <label className={labelClass}>種別</label>
                  <select
                    className={selectClass}
                    value={selectedNode.type}
                    onChange={(e) =>
                      updateNode(selectedNode.id, {
                        type: e.target.value as NodeType,
                      })
                    }
                  >
                    {NODE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ラベル</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={selectedNode.label}
                    onChange={(e) =>
                      updateNode(selectedNode.id, { label: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>サブラベル</label>
                  <input
                    className={inputClass}
                    value={selectedNode.sublabel ?? ""}
                    onChange={(e) =>
                      updateNode(selectedNode.id, {
                        sublabel: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>レーン</label>
                  <select
                    className={selectClass}
                    value={selectedNode.lane}
                    onChange={(e) =>
                      updateNode(selectedNode.id, { lane: e.target.value })
                    }
                  >
                    {schema.lanes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Phase</label>
                  <select
                    className={selectClass}
                    value={selectedNode.phase ?? ""}
                    onChange={(e) =>
                      updateNode(selectedNode.id, {
                        phase: e.target.value || null,
                      })
                    }
                  >
                    <option value="">なし</option>
                    {schema.phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>スタイル</label>
                  <select
                    className={selectClass}
                    value={selectedNode.style}
                    onChange={(e) =>
                      updateNode(selectedNode.id, {
                        style: e.target.value as NodeStyle,
                      })
                    }
                  >
                    {NODE_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedEdge && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  エッジ: {selectedEdge.id}
                </h3>
                <div>
                  <label className={labelClass}>接続元 (source)</label>
                  <select
                    className={selectClass}
                    value={selectedEdge.source}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, {
                        source: e.target.value,
                      })
                    }
                  >
                    {schema.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>接続先 (target)</label>
                  <select
                    className={selectClass}
                    value={selectedEdge.target}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, {
                        target: e.target.value,
                      })
                    }
                  >
                    {schema.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>種別</label>
                  <select
                    className={selectClass}
                    value={selectedEdge.type}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, {
                        type: e.target.value as EdgeType,
                      })
                    }
                  >
                    {EDGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ラベル</label>
                  <input
                    className={inputClass}
                    value={selectedEdge.label ?? ""}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, {
                        label: e.target.value || null,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <SchemaInfoPanel
                schema={schema}
                updateSchema={updateSchema}
                inputClass={inputClass}
                selectClass={selectClass}
                labelClass={labelClass}
              />
            )}
          </>
        )}

        {tab === "comments" && (
          <CommentsPanel
            schema={schema}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            addComment={addComment}
            resolveComment={resolveComment}
          />
        )}
      </div>
    </div>
  );
}

function CommentsPanel({
  schema,
  selectedNodeId,
  selectedEdgeId,
  addComment,
  resolveComment,
}: {
  schema: FlowChartSchema;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  addComment: (type: "node" | "edge", id: string, text: string) => void;
  resolveComment: (
    type: "node" | "edge",
    id: string,
    commentId: string,
  ) => void;
}) {
  const [newText, setNewText] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const allComments: {
    targetType: "node" | "edge";
    targetId: string;
    targetLabel: string;
    comment: FlowChartSchema["nodes"][0]["comments"][0];
  }[] = [];

  for (const node of schema.nodes) {
    for (const comment of node.comments) {
      if (!showResolved && comment.resolved) continue;
      allComments.push({
        targetType: "node",
        targetId: node.id,
        targetLabel: node.label,
        comment,
      });
    }
  }
  for (const edge of schema.edges) {
    for (const comment of edge.comments) {
      if (!showResolved && comment.resolved) continue;
      allComments.push({
        targetType: "edge",
        targetId: edge.id,
        targetLabel: `${edge.source} → ${edge.target}`,
        comment,
      });
    }
  }

  const canAddComment = selectedNodeId || selectedEdgeId;
  const targetType = selectedNodeId ? "node" : "edge";
  const targetId = selectedNodeId ?? selectedEdgeId ?? "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          コメント
        </h3>
        <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          解決済みも表示
        </label>
      </div>

      {allComments.length === 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          コメントはありません
        </div>
      )}

      {allComments.map((item) => (
        <div
          key={item.comment.id}
          className={`p-2 rounded text-xs ${item.comment.resolved ? "bg-gray-50 dark:bg-gray-800 opacity-60" : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {item.targetLabel}
            </span>
            <span className="text-gray-400 dark:text-gray-500">
              {item.comment.author}
            </span>
          </div>
          <div className="text-gray-700 dark:text-gray-300 mb-1">
            {item.comment.text}
          </div>
          {!item.comment.resolved && (
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() =>
                resolveComment(item.targetType, item.targetId, item.comment.id)
              }
            >
              解決済みにする
            </button>
          )}
        </div>
      ))}

      {canAddComment && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-2">
          <textarea
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-gray-200"
            rows={2}
            placeholder="コメントを追加..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={!newText.trim()}
            onClick={() => {
              addComment(targetType, targetId, newText.trim());
              setNewText("");
            }}
          >
            追加
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Schema info panel (shown when nothing is selected) ----

const GRANULARITY_OPTIONS: { value: FlowMeta["granularity"]; label: string }[] =
  [
    { value: "executive", label: "経営層向け" },
    { value: "business", label: "業務担当者向け" },
    { value: "engineer", label: "エンジニア向け" },
  ];

function SchemaInfoPanel({
  schema,
  updateSchema,
  inputClass,
  selectClass,
  labelClass,
}: {
  schema: FlowChartSchema;
  updateSchema: (updater: (prev: FlowChartSchema) => FlowChartSchema) => void;
  inputClass: string;
  selectClass: string;
  labelClass: string;
}) {
  const updateMeta = useCallback(
    (partial: Partial<FlowMeta>) => {
      updateSchema((prev) => ({
        ...prev,
        meta: { ...prev.meta, ...partial },
      }));
    },
    [updateSchema],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        フロー情報
      </h3>
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded p-2 leading-relaxed">
        ヒント: ノードはダブルクリックでラベル編集できます。ショートカット
        <span className="font-medium"> ⌘/Ctrl+S </span>
        で保存、
        <span className="font-medium"> ⌘/Ctrl+O </span>
        で読込、
        <span className="font-medium"> ⌘/Ctrl+L </span>
        で自動レイアウトを実行できます。
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>フロー名称</label>
          <input
            className={inputClass}
            value={schema.meta.name}
            onChange={(e) => updateMeta({ name: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>サブタイトル</label>
          <input
            className={inputClass}
            value={schema.meta.subtitle ?? ""}
            onChange={(e) =>
              updateMeta({ subtitle: e.target.value || undefined })
            }
            placeholder="概要説明（任意）"
          />
        </div>
        <div>
          <label className={labelClass}>目的</label>
          <textarea
            className={inputClass}
            rows={2}
            value={schema.meta.purpose}
            onChange={(e) => updateMeta({ purpose: e.target.value })}
            placeholder="〜が完了するまで"
          />
        </div>
        <div>
          <label className={labelClass}>粒度</label>
          <select
            className={selectClass}
            value={schema.meta.granularity}
            onChange={(e) =>
              updateMeta({
                granularity: e.target.value as FlowMeta["granularity"],
              })
            }
          >
            {GRANULARITY_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>バージョン</label>
          <input
            className={inputClass}
            value={schema.meta.version}
            onChange={(e) => updateMeta({ version: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <EditableList
          title="設計判断メモ"
          items={schema.designNotes}
          onChange={(items) =>
            updateSchema((prev) => ({ ...prev, designNotes: items }))
          }
          placeholder="判断メモを追加…"
          inputClass={inputClass}
          labelClass={labelClass}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <EditableList
          title="要確認事項"
          items={schema.openQuestions}
          onChange={(items) =>
            updateSchema((prev) => ({ ...prev, openQuestions: items }))
          }
          placeholder="確認事項を追加…"
          inputClass={inputClass}
          labelClass={labelClass}
        />
      </div>
    </div>
  );
}

// ---- Editable string list ----

function EditableList({
  title,
  items,
  onChange,
  placeholder,
  inputClass,
  labelClass,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  inputClass: string;
  labelClass: string;
}) {
  const [newText, setNewText] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingIdx !== null) editRef.current?.focus();
  }, [editingIdx]);

  const add = useCallback(() => {
    if (!newText.trim()) return;
    onChange([...items, newText.trim()]);
    setNewText("");
  }, [items, newText, onChange]);

  const remove = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange],
  );

  const commitEdit = useCallback(() => {
    if (editingIdx === null) return;
    if (editValue.trim()) {
      onChange(
        items.map((item, i) => (i === editingIdx ? editValue.trim() : item)),
      );
    }
    setEditingIdx(null);
  }, [editingIdx, editValue, items, onChange]);

  return (
    <div className="space-y-2">
      <label className={labelClass}>{title}</label>

      {items.length === 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500">なし</div>
      )}

      {items.map((item, i) => (
        <div key={i} className="group flex gap-1 items-start text-xs">
          <span className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0">
            •
          </span>
          {editingIdx === i ? (
            <textarea
              ref={editRef}
              className={`${inputClass} text-xs flex-1`}
              rows={2}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") setEditingIdx(null);
              }}
              onBlur={commitEdit}
            />
          ) : (
            <span
              className="flex-1 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onDoubleClick={() => {
                setEditingIdx(i);
                setEditValue(item);
              }}
            >
              {item}
            </span>
          )}
          <button
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-sm leading-none"
            onClick={() => remove(i)}
            title="削除"
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-1">
        <input
          className={`${inputClass} text-xs flex-1`}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
          disabled={!newText.trim()}
          onClick={add}
        >
          追加
        </button>
      </div>
    </div>
  );
}
