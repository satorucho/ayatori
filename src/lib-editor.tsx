/**
 * AyatoriEmbed — Lightweight editor component for Claude Artifacts.
 *
 * Provides:
 * - Visual flowchart rendering with React Flow
 * - YAML text editing mode
 * - YAML download
 * - Theme support
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { FlowChartSchema, FlowLayout } from "./types/schema.ts";
import { yamlToSchema, schemaToYaml } from "./schema/yaml.ts";
import { computeAllSizes, calculateLayout, calculateLaneDividers, calculatePhaseDividers } from "./layout/engine.ts";
import type { LaneBoundary, PhaseBoundary } from "./layout/types.ts";
import { nodeTypes } from "./editor/nodes/index.ts";
import { edgeTypes } from "./editor/edges/index.ts";
import { FONT_FAMILY, COLORS } from "./layout/constants.ts";
import { LayoutContext } from "./editor/contexts/LayoutContext.ts";
import { EditContext } from "./editor/contexts/EditContext.ts";
import LaneOverlay from "./editor/overlays/LaneOverlay.tsx";
import PhaseOverlay from "./editor/overlays/PhaseOverlay.tsx";
import { schemaToReactFlowEdges, schemaToReactFlowNodes } from "./editor/adapters/flow-adapter.ts";

export interface EmbedApi {
  setYaml: (yaml: string) => void;
  getYaml: () => string;
}

export interface AyatoriEmbedProps {
  initialYaml: string;
  editable?: boolean;
  onYamlChange?: (yaml: string) => void;
  theme?: "light" | "dark" | "auto";
  onReady?: (api: EmbedApi) => void;
}

// ---- Arrow marker defs ----
function ArrowDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <marker id="arrow-default" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
          <polygon points="0 0,7 2.5,0 5" fill={COLORS.arrow.default} />
        </marker>
        <marker id="arrow-loop" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
          <polygon points="0 0,7 2.5,0 5" fill={COLORS.arrow.loop} />
        </marker>
        <marker id="arrow-selected" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
          <polygon points="0 0,7 2.5,0 5" fill="#3b82f6" />
        </marker>
      </defs>
    </svg>
  );
}

// ---- Inner component (needs ReactFlowProvider) ----
function EmbedInner({
  initialYaml,
  editable = true,
  onYamlChange,
  theme = "auto",
  onReady,
}: AyatoriEmbedProps) {
  const [yamlText, setYamlText] = useState(initialYaml);
  const [baseYaml, setBaseYaml] = useState(initialYaml);
  const [schema, setSchema] = useState<FlowChartSchema | null>(null);
  const [layoutState, setLayoutState] = useState<FlowLayout | null>(null);
  const [laneBoundaries, setLaneBoundaries] = useState<LaneBoundary[]>([]);
  const [phaseBoundaries, setPhaseBoundaries] = useState<PhaseBoundary[]>([]);
  const [showYaml, setShowYaml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const { fitBounds, getNodes } = useReactFlow();
  const initializedRef = useRef(false);
  const hasChanges = yamlText !== baseYaml;

  // Apply theme
  useEffect(() => {
    const resolvedTheme = theme === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
  }, [theme]);

  const doLayout = useCallback(async (s: FlowChartSchema) => {
    try {
      const newLayout = await calculateLayout(s);
      const newSizes = computeAllSizes(s);
      const rfNodes = schemaToReactFlowNodes(s, newLayout, newSizes);
      const rfEdges = schemaToReactFlowEdges(s, newLayout);
      setSchema({ ...s, layout: newLayout });
      setLayoutState(newLayout);
      setNodes(rfNodes);
      setEdges(rfEdges);
      setLaneBoundaries(calculateLaneDividers(newLayout.positions, s, newSizes));
      setPhaseBoundaries(calculatePhaseDividers(newLayout.positions, s, newSizes));
      setError(null);
      return { layout: newLayout, schema: { ...s, layout: newLayout } };
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    queueMicrotask(() => {
      try {
        const s = yamlToSchema(initialYaml);
        const normalized = schemaToYaml(s);
        setYamlText(normalized);
        setBaseYaml(normalized);
        void doLayout(s).then(() => {
          setTimeout(() => {
            const allNodes = getNodes();
            if (allNodes.length === 0) return;
            let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
            for (const n of allNodes) {
              const w = n.measured?.width ?? (n.width as number | undefined) ?? 200;
              const h = n.measured?.height ?? (n.height as number | undefined) ?? 40;
              mnX = Math.min(mnX, n.position.x);
              mnY = Math.min(mnY, n.position.y);
              mxX = Math.max(mxX, n.position.x + w);
              mxY = Math.max(mxY, n.position.y + h);
            }
            fitBounds(
              { x: mnX - 40, y: mnY - 100, width: mxX - mnX + 80, height: mxY - mnY + 200 },
              { duration: 200 },
            );
          }, 100);
        });
      } catch (err) {
        setError(String(err));
      }
    });
  }, [initialYaml, doLayout, fitBounds, getNodes]);

  // Expose API
  useEffect(() => {
    if (!onReady) return;
    onReady({
      setYaml: (newYaml: string) => {
        try {
          const s = yamlToSchema(newYaml);
          const normalized = schemaToYaml(s);
          setYamlText(normalized);
          setBaseYaml(normalized);
          doLayout(s);
        } catch (err) {
          setError(String(err));
        }
      },
      getYaml: () => yamlText,
    });
  }, [onReady, yamlText, doLayout]);

  const handleYamlApply = useCallback(() => {
    try {
      const s = yamlToSchema(yamlText);
      const normalized = schemaToYaml(s);
      setYamlText(normalized);
      doLayout(s);
      onYamlChange?.(normalized);
      setShowYaml(false);
    } catch (err) {
      setError(String(err));
    }
  }, [yamlText, doLayout, onYamlChange]);

  const handleDownloadYaml = useCallback(() => {
    const content = hasChanges
      ? yamlText
      : schema
        ? schemaToYaml(schema)
        : yamlText;
    const blob = new Blob([content], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema?.meta.name ?? "flowchart"}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [hasChanges, schema, yamlText]);

  const layoutCtx = useMemo(() => ({ phaseBoundaries }), [phaseBoundaries]);
  const editCtx = useMemo(() => ({
    updateNodeLabel: () => {},
    updateEdgeLabel: () => {},
  }), []);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
        borderBottom: "1px solid #e5e7eb", background: "#fff", fontSize: 13,
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Ayatori</span>
        <span style={{ color: "#999", fontSize: 11 }}>{schema?.meta.name ?? ""}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: hasChanges ? "#b91c1c" : "#15803d",
            background: hasChanges ? "#fee2e2" : "#dcfce7",
            border: `1px solid ${hasChanges ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {hasChanges ? "● 変更あり" : "● 変更なし"}
        </span>
        <div style={{ flex: 1 }} />
        {editable && (
          <button
            onClick={() => setShowYaml(!showYaml)}
            style={btnStyle}
          >
            {showYaml ? "ビジュアル" : "YAML編集"}
          </button>
        )}
        <button
          onClick={handleDownloadYaml}
          style={hasChanges ? { ...btnStyle, background: "#111827", color: "#fff", borderColor: "#111827" } : btnStyle}
        >
          {hasChanges ? "変更後YAMLをダウンロード" : "YAMLダウンロード"}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "8px 12px", background: "#fef2f2", color: "#b91c1c",
          fontSize: 12, borderBottom: "1px solid #fecaca",
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {showYaml ? (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <textarea
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              style={{
                flex: 1, padding: 12, fontFamily: "monospace", fontSize: 12,
                border: "none", outline: "none", resize: "none",
                background: "#1e1e2e", color: "#cdd6f4",
              }}
            />
            <div style={{ padding: 8, background: "#f3f4f6", borderTop: "1px solid #e5e7eb" }}>
              <button onClick={handleYamlApply} style={{ ...btnStyle, background: "#222", color: "#fff" }}>
                適用して表示
              </button>
            </div>
          </div>
        ) : (
          <>
            <ArrowDefs />
            <EditContext.Provider value={editCtx}>
              <LayoutContext.Provider value={layoutCtx}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{ type: "flowEdge" }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag={true}
                  zoomOnScroll={true}
                  fitView={false}
                >
                  <Background />
                  <Controls showFitView={true} />
                  {schema && layoutState && (
                    <>
                      <LaneOverlay
                        schema={schema}
                        laneBoundaries={laneBoundaries}
                      />
                      <PhaseOverlay
                        schema={schema}
                        phaseBoundaries={phaseBoundaries}
                        laneBoundaries={laneBoundaries}
                      />
                    </>
                  )}
                </ReactFlow>
              </LayoutContext.Provider>
            </EditContext.Provider>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: FONT_FAMILY,
};

// ---- Public component ----
export function AyatoriEmbed(props: AyatoriEmbedProps) {
  return (
    <ReactFlowProvider>
      <EmbedInner {...props} />
    </ReactFlowProvider>
  );
}
