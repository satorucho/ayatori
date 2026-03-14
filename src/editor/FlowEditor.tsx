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
import { useTheme, useThemeColors } from "../theme/useTheme.ts";
import { LayoutContext } from "./contexts/LayoutContext.ts";
import { EditContext } from "./contexts/EditContext.ts";

interface FlowEditorProps {
  initialSchema: FlowChartSchema;
}

function ArrowDefs() {
  const colors = useThemeColors();
  return (
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
          <polygon points="0 0,7 2.5,0 5" fill={colors.arrow.default} />
        </marker>
        <marker
          id="arrow-orange"
          markerWidth="7"
          markerHeight="5"
          refX="7"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0,7 2.5,0 5" fill={colors.arrow.orange} />
        </marker>
        <marker
          id="arrow-green"
          markerWidth="7"
          markerHeight="5"
          refX="7"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0,7 2.5,0 5" fill={colors.arrow.green} />
        </marker>
        <marker
          id="arrow-loop"
          markerWidth="7"
          markerHeight="5"
          refX="7"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0,7 2.5,0 5" fill={colors.arrow.loop} />
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
}

function FlowEditorInner({ initialSchema }: FlowEditorProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    onNodeDragStop,
    schema,
    updateSchema,
    runAutoLayout,
    exportJSON,
    exportYAML,
    importJSON,
    addNode,
    swapLanes,
    addLane,
    renameLane,
    removeLane,
    addPhase,
    renamePhase,
    removePhase,
    swapPhases,
    sizes,
    laneBoundaries,
    phaseBoundaries,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    freeDrawMode,
    setFreeDrawMode,
  } = useFlowState(initialSchema);

  const { isDark } = useTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const initialLayoutDone = useRef(false);

  const fitViewOptions = useMemo(() => ({ padding: 0.15 }), []);
  const layoutCtx = useMemo(() => ({ phaseBoundaries }), [phaseBoundaries]);

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
      runAutoLayout().then(() => resetHistory());
    }
  }, [runAutoLayout, resetHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

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
    setEditingNode(null);
  }, []);

  // --- Inline node label editing ---
  const [editingNode, setEditingNode] = useState<{
    id: string;
    value: string;
    rect: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const editNodeRef = useRef<HTMLTextAreaElement>(null);

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, rfNode: { id: string }) => {
      const node = schema.nodes.find((n) => n.id === rfNode.id);
      if (!node) return;
      const el = document.querySelector(
        `.react-flow__node[data-id="${rfNode.id}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setEditingNode({
        id: rfNode.id,
        value: node.label,
        rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      });
      setTimeout(() => editNodeRef.current?.focus(), 0);
    },
    [schema.nodes],
  );

  const commitNodeEdit = useCallback(() => {
    if (editingNode && editingNode.value.trim()) {
      updateSchema((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === editingNode.id
            ? { ...n, label: editingNode.value.trim() }
            : n,
        ),
      }));
    }
    setEditingNode(null);
  }, [editingNode, updateSchema]);

  // --- EditContext for edge label inline editing ---
  const updateNodeLabel = useCallback(
    (nodeId: string, label: string) => {
      updateSchema((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, label } : n,
        ),
      }));
    },
    [updateSchema],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      updateSchema((prev) => ({
        ...prev,
        edges: prev.edges.map((e) =>
          e.id === edgeId ? { ...e, label: label || null } : e,
        ),
      }));
    },
    [updateSchema],
  );

  const editCtx = useMemo(
    () => ({ updateNodeLabel, updateEdgeLabel }),
    [updateNodeLabel, updateEdgeLabel],
  );

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

  return (
    <div className="h-full flex flex-col">
      <ArrowDefs />
      <Toolbar
        onAutoLayout={runAutoLayout}
        onExportJSON={exportJSON}
        onExportYAML={exportYAML}
        onImportJSON={importJSON}
        onExportSVG={handleExportSVG}
        onExportHTML={handleExportHTML}
        onExportPNG={handleExportPNG}
        onAddNode={addNode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        freeDrawMode={freeDrawMode}
        onToggleFreeDrawMode={() => setFreeDrawMode(!freeDrawMode)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onAddLane={() => addLane()}
        onAddPhase={() => addPhase()}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <EditContext.Provider value={editCtx}>
            <LayoutContext.Provider value={layoutCtx}>
              <ReactFlow
                nodes={nodes}
                edges={edgesWithReconnectable}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onNodeDragStop={onNodeDragStop}
                reconnectRadius={20}
                connectionMode="loose"
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={{ type: "flowEdge" }}
                colorMode={isDark ? "dark" : "light"}
              >
                <Background />
                <Controls fitViewOptions={fitViewOptions} />
                <MiniMap />
                <LaneOverlay
                  schema={schema}
                  laneBoundaries={laneBoundaries}
                  onSwapLanes={swapLanes}
                  onAddLane={addLane}
                  onRenameLane={renameLane}
                  onRemoveLane={removeLane}
                />
                <PhaseOverlay
                  schema={schema}
                  phaseBoundaries={phaseBoundaries}
                  laneBoundaries={laneBoundaries}
                  onAddPhase={addPhase}
                  onRenamePhase={renamePhase}
                  onRemovePhase={removePhase}
                  onSwapPhases={swapPhases}
                />
              </ReactFlow>
            </LayoutContext.Provider>
          </EditContext.Provider>

          {editingNode && (
            <textarea
              ref={editNodeRef}
              className="fixed z-[9999] px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 dark:text-gray-100 outline-none text-center resize-none"
              style={{
                left: editingNode.rect.x,
                top: editingNode.rect.y,
                width: editingNode.rect.w,
                height: editingNode.rect.h,
              }}
              value={editingNode.value}
              onChange={(e) =>
                setEditingNode((prev) =>
                  prev ? { ...prev, value: e.target.value } : null,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitNodeEdit();
                }
                if (e.key === "Escape") setEditingNode(null);
              }}
              onBlur={commitNodeEdit}
            />
          )}
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
