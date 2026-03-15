import { useState, useCallback, useEffect } from "react";
import FlowEditor from "./editor/FlowEditor.tsx";
import type { FlowChartSchema } from "./types/schema.ts";
import { parseSchemaText } from "./schema/parse.ts";

function withBase(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${normalized}`;
}

const EMPTY_SCHEMA: FlowChartSchema = {
  schemaVersion: "1",
  meta: {
    name: "新規フロー",
    purpose: "",
    granularity: "business",
    version: new Date().toISOString().split("T")[0],
  },
  lanes: [{ id: "lane-default", label: "担当者", order: 0 }],
  phases: [],
  nodes: [
    {
      id: "n-start",
      type: "start",
      label: "開始",
      sublabel: null,
      lane: "lane-default",
      phase: null,
      style: "default",
      comments: [],
      decisionMeta: null,
      timeLabel: null,
    },
    {
      id: "n-end",
      type: "end",
      label: "完了",
      sublabel: null,
      lane: "lane-default",
      phase: null,
      style: "default",
      comments: [],
      decisionMeta: null,
      timeLabel: null,
    },
  ],
  edges: [
    {
      id: "e1",
      source: "n-start",
      target: "n-end",
      type: "normal",
      label: null,
      comments: [],
    },
  ],
  layout: null,
  designNotes: [],
  openQuestions: [],
};

export default function App() {
  const [schema, setSchema] = useState<FlowChartSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleNew = useCallback(() => {
    setSchema({ ...EMPTY_SCHEMA });
  }, []);

  const handleLoadSample = useCallback(async (filename: string) => {
    setLoading(true);
    try {
      const res = await fetch(withBase(`sample-flows/${filename}`));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      const parsed = parseSchemaText(text);
      if (!parsed.ok) {
        setNotice({ type: "error", message: parsed.error });
        return;
      }
      setSchema(parsed.schema);
    } catch (err) {
      setNotice({
        type: "error",
        message: `サンプルの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".yaml,.yml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        const parsed = parseSchemaText(text);
        if (!parsed.ok) {
          setNotice({ type: "error", message: parsed.error });
          return;
        }
        setSchema(parsed.schema);
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  if (schema) {
    return (
      <div className="h-screen">
        <FlowEditor initialSchema={schema} />
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex flex-col items-center gap-3">
          <img
            src={withBase("logo.svg")}
            alt="Ayatori"
            className="w-28 h-28 dark:invert"
          />
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 font-mono">
            ayatori
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          業務フローチャートの双方向エディタ
        </p>
        <div className="space-y-3">
          {notice && (
            <div
              className={`text-left text-sm px-3 py-2 rounded border ${
                notice.type === "error"
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                  : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
              }`}
            >
              {notice.message}
            </div>
          )}
          <button
            onClick={handleNew}
            className="w-full px-6 py-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors font-medium"
          >
            新規フローを作成
          </button>
          <button
            onClick={handleFileOpen}
            className="w-full px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            ファイルを開く（YAML）
          </button>
          <div className="pt-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              サンプル
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleLoadSample("simple-flow.yaml")}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                簡単な承認フロー
              </button>
              <button
                onClick={() => handleLoadSample("asis-flow.yaml")}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                AsIs体験フロー
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
