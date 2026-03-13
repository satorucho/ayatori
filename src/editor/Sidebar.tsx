import { useState, useCallback } from "react";
import type {
  FlowChartSchema,
  FlowNode,
  FlowEdge,
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
  onClose: () => void;
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
  onClose,
}: SidebarProps) {
  const [tab, setTab] = useState<TabId>("properties");

  const selectedNode = selectedNodeId
    ? schema.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? schema.edges.find((e) => e.id === selectedEdgeId) ?? null
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
    (
      targetType: "node" | "edge",
      targetId: string,
      commentId: string,
    ) => {
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
    "w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectClass =
    "w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            className={`px-3 py-1 text-xs rounded ${tab === "properties" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setTab("properties")}
          >
            プロパティ
          </button>
          <button
            className={`px-3 py-1 text-xs rounded ${tab === "comments" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setTab("comments")}
          >
            コメント
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === "properties" && (
          <>
            {selectedNode && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
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
                <h3 className="text-sm font-semibold text-gray-700">
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
              <div className="text-sm text-gray-400 text-center mt-8">
                ノードまたはエッジを選択してください
              </div>
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
  resolveComment: (type: "node" | "edge", id: string, commentId: string) => void;
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
        <h3 className="text-sm font-semibold text-gray-700">コメント</h3>
        <label className="text-xs text-gray-500 flex items-center gap-1">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          解決済みも表示
        </label>
      </div>

      {allComments.length === 0 && (
        <div className="text-xs text-gray-400">コメントはありません</div>
      )}

      {allComments.map((item) => (
        <div
          key={item.comment.id}
          className={`p-2 rounded text-xs ${item.comment.resolved ? "bg-gray-50 opacity-60" : "bg-yellow-50 border border-yellow-200"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-600">
              {item.targetLabel}
            </span>
            <span className="text-gray-400">{item.comment.author}</span>
          </div>
          <div className="text-gray-700 mb-1">{item.comment.text}</div>
          {!item.comment.resolved && (
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                resolveComment(
                  item.targetType,
                  item.targetId,
                  item.comment.id,
                )
              }
            >
              解決済みにする
            </button>
          )}
        </div>
      ))}

      {canAddComment && (
        <div className="border-t border-gray-200 pt-2 space-y-2">
          <textarea
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
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
