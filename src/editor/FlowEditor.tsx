import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowChartSchema } from "../types/schema.ts";
import { nodeTypes } from "./nodes/index.ts";
import { edgeTypes } from "./edges/index.ts";
import { useFlowState } from "./hooks/useFlowState.ts";
import Toolbar from "./Toolbar.tsx";
import { exportToSVG } from "../export/to-svg.ts";
import { exportToHTML } from "../export/to-html.ts";
import { exportToPNG } from "../export/to-png.ts";
import Sidebar from "./Sidebar.tsx";
import LaneOverlay from "./overlays/LaneOverlay.tsx";
import PhaseOverlay from "./overlays/PhaseOverlay.tsx";

interface FlowEditorProps {
  initialSchema: FlowChartSchema;
}

const ARROW_DEFS = (
  <svg style={{ position: "absolute", width: 0, height: 0 }}>
    <defs>
      <marker
        id="arrow-default"
        markerWidth="7"
        markerHeight="5"
        refX="7"
        refY="2.5"
        orient="auto"
      >
        <polygon points="0 0,7 2.5,0 5" fill="#222" />
      </marker>
      <marker
        id="arrow-orange"
        markerWidth="7"
        markerHeight="5"
        refX="7"
        refY="2.5"
        orient="auto"
      >
        <polygon points="0 0,7 2.5,0 5" fill="#c87800" />
      </marker>
      <marker
        id="arrow-green"
        markerWidth="7"
        markerHeight="5"
        refX="7"
        refY="2.5"
        orient="auto"
      >
        <polygon points="0 0,7 2.5,0 5" fill="#2a7a2a" />
      </marker>
      <marker
        id="arrow-loop"
        markerWidth="7"
        markerHeight="5"
        refX="7"
        refY="2.5"
        orient="auto"
      >
        <polygon points="0 0,7 2.5,0 5" fill="#888" />
      </marker>
      <marker
        id="arrow-selected"
        markerWidth="7"
        markerHeight="5"
        refX="7"
        refY="2.5"
        orient="auto"
      >
        <polygon points="0 0,7 2.5,0 5" fill="#3b82f6" />
      </marker>
    </defs>
  </svg>
);

function FlowEditorInner({ initialSchema }: FlowEditorProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    schema,
    updateSchema,
    runAutoLayout,
    exportJSON,
    importJSON,
    addNode,
    sizes,
    laneBoundaries,
  } = useFlowState(initialSchema);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const initialLayoutDone = useRef(false);

  const edgesWithReconnectable = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        reconnectable: e.id === selectedEdgeId,
      })),
    [edges, selectedEdgeId],
  );

  useEffect(() => {
    if (!initialLayoutDone.current) {
      initialLayoutDone.current = true;
      runAutoLayout();
    }
  }, [runAutoLayout]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const downloadFile = useCallback(
    (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const handleExportSVG = useCallback(() => {
    if (!schema.layout) return;
    const svg = exportToSVG(schema, schema.layout, sizes);
    downloadFile(svg, "flowchart.svg", "image/svg+xml");
  }, [schema, sizes, downloadFile]);

  const handleExportHTML = useCallback(() => {
    if (!schema.layout) return;
    const html = exportToHTML(schema, schema.layout, sizes);
    downloadFile(html, "flowchart.html", "text/html");
  }, [schema, sizes, downloadFile]);

  const handleExportPNG = useCallback(async () => {
    if (!schema.layout) return;
    const svg = exportToSVG(schema, schema.layout, sizes);
    const blob = await exportToPNG(svg);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchart.png";
    a.click();
    URL.revokeObjectURL(url);
  }, [schema, sizes]);

  const unresolvedCount = schema.nodes.reduce(
    (count, n) => count + n.comments.filter((c) => !c.resolved).length,
    0,
  ) + schema.edges.reduce(
    (count, e) => count + e.comments.filter((c) => !c.resolved).length,
    0,
  );

  return (
    <div className="h-full flex flex-col">
      {ARROW_DEFS}
      <Toolbar
        onAutoLayout={runAutoLayout}
        onExportJSON={exportJSON}
        onImportJSON={importJSON}
        onExportSVG={handleExportSVG}
        onExportHTML={handleExportHTML}
        onExportPNG={handleExportPNG}
        onAddNode={addNode}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edgesWithReconnectable}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            reconnectRadius={20}
            connectionMode="loose"
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            defaultEdgeOptions={{ type: "flowEdge" }}
          >
            <Background />
            <Controls />
            <MiniMap />
            <LaneOverlay schema={schema} laneBoundaries={laneBoundaries} />
            <PhaseOverlay schema={schema} sizes={sizes} />
          </ReactFlow>
        </div>
        {sidebarOpen && (
          <Sidebar
            schema={schema}
            updateSchema={updateSchema}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>
      <div className="h-8 bg-gray-100 border-t border-gray-200 flex items-center px-4 text-xs text-gray-500 gap-4">
        <span>ノード: {schema.nodes.length}</span>
        <span>エッジ: {schema.edges.length}</span>
        {unresolvedCount > 0 && (
          <span className="text-orange-600">
            未解決コメント: {unresolvedCount}
          </span>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          {sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
        </button>
      </div>
    </div>
  );
}

export default function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
