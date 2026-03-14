import { useState, useCallback } from "react";
import FlowEditor from "./editor/FlowEditor.tsx";
import type { FlowChartSchema } from "./types/schema.ts";
import { hydrateSchema } from "./schema/hydrate.ts";
import { yamlToSchema } from "./schema/yaml.ts";

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
      referenceTargetId: null,
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
      referenceTargetId: null,
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

  const handleNew = useCallback(() => {
    setSchema({ ...EMPTY_SCHEMA });
  }, []);

  const handleLoadSample = useCallback(async (filename: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/sample-flows/${filename}`);
      if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
        const text = await res.text();
        setSchema(yamlToSchema(text));
      } else {
        const data = await res.json();
        setSchema(hydrateSchema(data as Record<string, unknown>));
      }
    } catch (err) {
      console.error("Failed to load sample:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.yaml,.yml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const isYaml = file.name.endsWith(".yaml") || file.name.endsWith(".yml");
          if (isYaml) {
            setSchema(yamlToSchema(text));
          } else {
            const data = JSON.parse(text) as Record<string, unknown>;
            setSchema(hydrateSchema(data));
          }
        } catch (err) {
          console.error("Invalid file:", err);
        }
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
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Ayatori</h1>
        <p className="text-gray-500 dark:text-gray-400">
          業務フローチャートの双方向エディタ
        </p>
        <div className="space-y-3">
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
            ファイルを開く（JSON / YAML）
          </button>
          <div className="pt-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">サンプル</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleLoadSample("simple-flow.json")}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                簡単な承認フロー
              </button>
              <button
                onClick={() => handleLoadSample("asis-flow.json")}
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
