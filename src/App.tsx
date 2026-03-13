import { useState, useCallback } from "react";
import FlowEditor from "./editor/FlowEditor.tsx";
import type { FlowChartSchema } from "./types/schema.ts";

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
      const data = await res.json();
      setSchema(data);
    } catch (err) {
      console.error("Failed to load sample:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          setSchema(data);
        } catch (err) {
          console.error("Invalid JSON:", err);
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
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold text-gray-800">Ayatori</h1>
        <p className="text-gray-500">
          業務フローチャートの双方向エディタ
        </p>
        <div className="space-y-3">
          <button
            onClick={handleNew}
            className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            新規フローを作成
          </button>
          <button
            onClick={handleFileOpen}
            className="w-full px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            JSONファイルを開く
          </button>
          <div className="pt-2">
            <p className="text-xs text-gray-400 mb-2">サンプル</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleLoadSample("simple-flow.json")}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                簡単な承認フロー
              </button>
              <button
                onClick={() => handleLoadSample("asis-flow.json")}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
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
