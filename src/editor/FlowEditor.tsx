import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
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
import YamlEditorPanel from "./YamlEditorPanel.tsx";
import LaneOverlay from "./overlays/LaneOverlay.tsx";
import PhaseOverlay from "./overlays/PhaseOverlay.tsx";
import { LANE, PHASE, FONT, FONT_FAMILY } from "../layout/constants.ts";
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
    exportYAML,
    importSchema,
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
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const initialLayoutDone = useRef(false);
  const { fitBounds, getNodes, getZoom } = useReactFlow();

  const customFitView = useCallback(() => {
    const allNodes = getNodes();
    if (allNodes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const node of allNodes) {
      const w = node.measured?.width ?? (node.width as number | undefined) ?? 200;
      const h = node.measured?.height ?? (node.height as number | undefined) ?? 40;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    if (schema.lanes.length > 1) {
      minY = Math.min(minY, minY - 120 - LANE.headerHeight);
    }
    for (const pb of phaseBoundaries) {
      const headerY = pb.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
      minY = Math.min(minY, headerY);
    }

    const PAD = 60;
    fitBounds(
      {
        x: minX - PAD,
        y: minY - PAD,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + PAD * 2,
      },
      { duration: 200 },
    );
  }, [getNodes, fitBounds, schema.lanes.length, phaseBoundaries]);

  const layoutCtx = useMemo(() => ({ phaseBoundaries }), [phaseBoundaries]);

  const nodesWithSelection = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );

  const edgesWithSelection = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        reconnectable: e.id === selectedEdgeId,
        selected: e.id === selectedEdgeId,
      })),
    [edges, selectedEdgeId],
  );

  useEffect(() => {
    if (!initialLayoutDone.current) {
      initialLayoutDone.current = true;
      runAutoLayout().then(() => {
        resetHistory();
        setTimeout(() => customFitView(), 50);
      });
    }
  }, [runAutoLayout, resetHistory, customFitView]);

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

  // --- Inline node label editing ---
  const [editingNode, setEditingNode] = useState<{
    id: string;
    value: string;
    rect: { x: number; y: number; w: number; h: number };
    zoom: number;
  } | null>(null);
  const editNodeRef = useRef<HTMLTextAreaElement>(null);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingNode(null);
  }, []);

  const pushNotice = useCallback((next: { type: "success" | "error"; message: string }) => {
    setNotice(next);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
        zoom: getZoom(),
      });
      setTimeout(() => editNodeRef.current?.focus(), 0);
    },
    [schema.nodes, getZoom],
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
        onExportYAML={exportYAML}
        onImportSchema={importSchema}
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
        yamlEditorOpen={yamlEditorOpen}
        onToggleYamlEditor={() => setYamlEditorOpen(!yamlEditorOpen)}
        onAddLane={() => addLane()}
        onAddPhase={() => addPhase()}
        onNotify={pushNotice}
      />
      <div className="flex-1 flex overflow-hidden">
        {yamlEditorOpen && (
          <YamlEditorPanel
            schema={schema}
            onImportSchema={importSchema}
          />
        )}
        <div className="flex-1 relative">
          {notice && (
            <div className="absolute top-3 right-3 z-[1200] pointer-events-none">
              <div
                className={`text-sm px-3 py-2 rounded border shadow-sm ${
                  notice.type === "error"
                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                }`}
              >
                {notice.message}
              </div>
            </div>
          )}
          <EditContext.Provider value={editCtx}>
            <LayoutContext.Provider value={layoutCtx}>
              <ReactFlow
                nodes={nodesWithSelection}
                edges={edgesWithSelection}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onNodeDragStop={onNodeDragStop}
                reconnectRadius={20}
                connectionMode={ConnectionMode.Loose}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: "flowEdge" }}
                colorMode={isDark ? "dark" : "light"}
              >
                <Background />
                <Controls showFitView={false}>
                  <button
                    className="react-flow__controls-button"
                    onClick={customFitView}
                    title="全体を表示"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <path d="M2 5.5H14M2 10.5H14M5.5 2V14M10.5 2V14" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
                    </svg>
                  </button>
                </Controls>
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
              className="fixed z-[9999] border border-blue-500 rounded outline-none text-center resize-none"
              style={{
                left: editingNode.rect.x,
                top: editingNode.rect.y,
                width: editingNode.rect.w,
                height: editingNode.rect.h,
                fontSize: FONT.nodeMain.size * editingNode.zoom,
                fontWeight: FONT.nodeMain.weight,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.5,
                padding: `${4 * editingNode.zoom}px ${8 * editingNode.zoom}px`,
                background: "transparent",
                color: "inherit",
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
