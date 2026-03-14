import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnReconnect,
  Connection,
} from "@xyflow/react";
import type { FlowChartSchema, FlowLayout, NodeType } from "../../types/schema.ts";
import { hydrateSchema } from "../../schema/hydrate.ts";
import { yamlToSchema, schemaToYaml } from "../../schema/yaml.ts";
import { computeAllSizes, calculateLayout, calculateLaneDividers, calculatePhaseDividers } from "../../layout/engine.ts";
import { resolveHandles } from "../../layout/edge-routing.ts";
import type { ShapeSize } from "../../layout/sizing.ts";
import type { LaneBoundary, PhaseBoundary } from "../../layout/types.ts";
import { generateId } from "../../utils/id.ts";
import { useUndoRedo } from "./useUndoRedo.ts";

/**
 * Determine which lane a node belongs to based on its center-X position
 * relative to lane boundaries.
 */
function determineLaneFromPosition(
  centerX: number,
  laneBoundaries: LaneBoundary[],
  schema: FlowChartSchema,
): string | null {
  if (laneBoundaries.length === 0) return null;

  const sortedLanes = [...schema.lanes].sort((a, b) => a.order - b.order);

  // Walk through boundaries; the node belongs to the lane whose region contains it
  for (let i = 0; i < laneBoundaries.length; i++) {
    const boundary = laneBoundaries[i];
    if (centerX <= boundary.dividerX) {
      return boundary.laneId;
    }
  }

  // If past all dividers, assign to the last lane
  return sortedLanes[sortedLanes.length - 1]?.id ?? null;
}

function determinePhaseFromPosition(
  centerY: number,
  phaseBoundaries: PhaseBoundary[],
  schema: FlowChartSchema,
): string | null {
  if (phaseBoundaries.length === 0) return null;

  const sortedPhases = [...schema.phases].sort((a, b) => a.order - b.order);

  for (const boundary of phaseBoundaries) {
    if (centerY <= boundary.dividerY) {
      return boundary.phaseId;
    }
  }

  return sortedPhases[sortedPhases.length - 1]?.id ?? null;
}

function schemaNodeTypeToRFType(
  type: string,
): string {
  if (type === "start" || type === "end") return "startEnd";
  return type;
}

function schemaToRFNodes(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): Node[] {
  return schema.nodes.map((node) => {
    const pos = layout.positions[node.id] ?? { x: 0, y: 0 };
    const size = sizes.get(node.id);

    let nodeW: number, nodeH: number;
    if (node.type === "decision" || node.type === "start" || node.type === "end") {
      nodeW = (size?.width ?? 50) * 2;
      nodeH = (size?.height ?? 50) * 2;
    } else {
      nodeW = size?.width ?? 200;
      nodeH = size?.height ?? 40;
    }

    return {
      id: node.id,
      type: schemaNodeTypeToRFType(node.type),
      position: {
        x: pos.x - nodeW / 2,
        y: pos.y - nodeH / 2,
      },
      data: {
        label: node.label,
        sublabel: node.sublabel,
        nodeStyle: node.style,
        nodeType: node.type,
        comments: node.comments,
        decisionMeta: node.decisionMeta,
        shapeWidth: size?.width ?? 50,
        shapeHeight: size?.height ?? 50,
      },
    };
  });
}

/**
 * Wrapper: resolve handles for an edge, falling back to default vertical
 * when no layout is available.
 */
function resolveHandlesForEditor(
  edge: FlowChartSchema["edges"][0],
  schema: FlowChartSchema,
  layout: FlowLayout | null,
): { sourceHandle: string; targetHandle: string } {
  if (!layout) {
    if (edge.type === "no") return { sourceHandle: "right", targetHandle: "left" };
    return { sourceHandle: "bottom", targetHandle: "top" };
  }
  return resolveHandles(edge, schema, layout);
}

function schemaToRFEdges(
  schema: FlowChartSchema,
  layout: FlowLayout | null = null,
): Edge[] {
  return schema.edges.map((edge) => {
    const { sourceHandle, targetHandle } = resolveHandlesForEditor(edge, schema, layout);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: "flowEdge",
      data: {
        edgeType: edge.type,
        edgeLabel: edge.label,
        comments: edge.comments,
      },
    };
  });
}

export function useFlowState(initialSchema: FlowChartSchema) {
  const {
    state: schema,
    setState: setSchema,
    undo: undoSchemaRaw,
    redo: redoSchemaRaw,
    canUndo,
    canRedo,
    resetHistory,
  } = useUndoRedo<FlowChartSchema>(initialSchema, 100);
  const [layoutState, setLayoutState] = useState<FlowLayout | null>(
    initialSchema.layout,
  );
  const [laneBoundaries, setLaneBoundaries] = useState<LaneBoundary[]>([]);
  const [phaseBoundaries, setPhaseBoundaries] = useState<PhaseBoundary[]>([]);
  const [freeDrawMode, setFreeDrawModeRaw] = useState(false);
  const [needsRelayout, setNeedsRelayout] = useState(false);

  const freeDrawModeRef = useRef(freeDrawMode);
  freeDrawModeRef.current = freeDrawMode;

  const requestRelayout = useCallback(() => {
    if (!freeDrawModeRef.current) setNeedsRelayout(true);
  }, []);

  const setFreeDrawMode = useCallback(
    (on: boolean) => {
      setFreeDrawModeRaw(on);
      freeDrawModeRef.current = on;
      if (!on) setNeedsRelayout(true);
    },
    [],
  );

  const sizes = useMemo(() => computeAllSizes(schema), [schema]);

  const rfNodesInit = useMemo(() => {
    if (!layoutState) return [];
    return schemaToRFNodes(schema, layoutState, sizes);
  }, []);

  const rfEdgesInit = useMemo(() => schemaToRFEdges(schema, layoutState), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodesInit);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdgesInit);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        id: generateId("e"),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? "bottom",
        targetHandle: connection.targetHandle ?? "top",
        type: "flowEdge" as const,
        data: {
          edgeType: "normal" as const,
          edgeLabel: null,
          comments: [],
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));

      setSchema((prev) => ({
        ...prev,
        edges: [
          ...prev.edges,
          {
            id: newEdge.id,
            source: connection.source,
            target: connection.target,
            type: "normal",
            label: null,
            comments: [],
          },
        ],
      }));
      requestRelayout();
    },
    [setSchema, setEdges, requestRelayout],
  );

  const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));

      setSchema((prev) => ({
        ...prev,
        edges: prev.edges.map((e) =>
          e.id === oldEdge.id
            ? { ...e, source: newConnection.source, target: newConnection.target }
            : e,
        ),
      }));
      requestRelayout();
    },
    [setSchema, setEdges, requestRelayout],
  );

  const runAutoLayout = useCallback(async () => {
    const newLayout = await calculateLayout(schema);
    setLayoutState(newLayout);

    const newSizes = computeAllSizes(schema);
    const newRFNodes = schemaToRFNodes(schema, newLayout, newSizes);
    const newRFEdges = schemaToRFEdges(schema, newLayout);

    setNodes(newRFNodes);
    setEdges(newRFEdges);
    setLaneBoundaries(calculateLaneDividers(newLayout.positions, schema, newSizes));
    setPhaseBoundaries(calculatePhaseDividers(newLayout.positions, schema, newSizes));

    setSchema((prev) => ({ ...prev, layout: newLayout }));
  }, [schema, setSchema, setNodes, setEdges]);

  useEffect(() => {
    if (!needsRelayout) return;
    setNeedsRelayout(false);
    runAutoLayout();
  }, [needsRelayout, runAutoLayout]);

  const updateSchema = useCallback(
    (updater: (prev: FlowChartSchema) => FlowChartSchema) => {
      setSchema((prev) => {
        const next = updater(prev);
        const newSizes = computeAllSizes(next);
        if (next.layout) {
          const newRFNodes = schemaToRFNodes(next, next.layout, newSizes);
          const newRFEdges = schemaToRFEdges(next, next.layout);
          setNodes(newRFNodes);
          setEdges(newRFEdges);
        }
        return next;
      });
      requestRelayout();
    },
    [setSchema, setNodes, setEdges, requestRelayout],
  );

  const exportJSON = useCallback(() => {
    return JSON.stringify(schema, null, 2);
  }, [schema]);

  const exportYAML = useCallback(() => {
    return schemaToYaml(schema);
  }, [schema]);

  const importJSON = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      let parsed: FlowChartSchema;
      if (trimmed.startsWith("{")) {
        parsed = hydrateSchema(JSON.parse(trimmed) as Record<string, unknown>);
      } else {
        parsed = yamlToSchema(trimmed);
      }
      setSchema(parsed);
      if (parsed.layout) {
        setLayoutState(parsed.layout);
        const newSizes = computeAllSizes(parsed);
        setNodes(schemaToRFNodes(parsed, parsed.layout, newSizes));
        setEdges(schemaToRFEdges(parsed, parsed.layout));
        setLaneBoundaries(calculateLaneDividers(parsed.layout.positions, parsed, newSizes));
        setPhaseBoundaries(calculatePhaseDividers(parsed.layout.positions, parsed, newSizes));
      }
      requestRelayout();
    },
    [setSchema, setNodes, setEdges, requestRelayout],
  );

  // Keep refs to boundaries for use in drag handler
  const laneBoundariesRef = useRef<LaneBoundary[]>(laneBoundaries);
  useEffect(() => {
    laneBoundariesRef.current = laneBoundaries;
  }, [laneBoundaries]);

  const phaseBoundariesRef = useRef<PhaseBoundary[]>(phaseBoundaries);
  useEffect(() => {
    phaseBoundariesRef.current = phaseBoundaries;
  }, [phaseBoundaries]);

  const rebuildFromSchema = useCallback(
    (s: FlowChartSchema) => {
      if (!s.layout) return;
      const newSizes = computeAllSizes(s);
      setNodes(schemaToRFNodes(s, s.layout, newSizes));
      setEdges(schemaToRFEdges(s, s.layout));
      setLayoutState(s.layout);
      setLaneBoundaries(calculateLaneDividers(s.layout.positions, s, newSizes));
      setPhaseBoundaries(calculatePhaseDividers(s.layout.positions, s, newSizes));
    },
    [setNodes, setEdges],
  );

  const undo = useCallback(() => {
    const restored = undoSchemaRaw();
    if (restored) rebuildFromSchema(restored);
  }, [undoSchemaRaw, rebuildFromSchema]);

  const redo = useCallback(() => {
    const restored = redoSchemaRaw();
    if (restored) rebuildFromSchema(restored);
  }, [redoSchemaRaw, rebuildFromSchema]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, rfNode: Node) => {
      const nodeData = rfNode.data as { shapeWidth?: number; shapeHeight?: number; nodeType?: string };
      const nodeType = nodeData?.nodeType ?? "process";
      const isDiamondOrEllipse = nodeType === "decision" || nodeType === "start" || nodeType === "end";

      let nodeW: number;
      let nodeH: number;
      if (isDiamondOrEllipse) {
        nodeW = (nodeData?.shapeWidth ?? 50) * 2;
        nodeH = (nodeData?.shapeHeight ?? 50) * 2;
      } else {
        nodeW = nodeData?.shapeWidth ?? 200;
        nodeH = nodeData?.shapeHeight ?? 40;
      }

      const centerX = rfNode.position.x + nodeW / 2;
      const centerY = rfNode.position.y + nodeH / 2;

      setSchema((prev) => {
        const existingNode = prev.nodes.find((n) => n.id === rfNode.id);
        if (!existingNode) return prev;

        const newLane = determineLaneFromPosition(
          centerX, laneBoundariesRef.current, prev,
        );
        const newPhase = determinePhaseFromPosition(
          centerY, phaseBoundariesRef.current, prev,
        );

        const laneChanged = newLane && newLane !== existingNode.lane;
        const phaseChanged = newPhase !== null && newPhase !== existingNode.phase;

        if (!laneChanged && !phaseChanged) return prev;

        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === rfNode.id
              ? {
                  ...n,
                  ...(laneChanged ? { lane: newLane } : {}),
                  ...(phaseChanged ? { phase: newPhase } : {}),
                }
              : n,
          ),
        };
      });

      // Auto-layout mode: always snap back to calculated positions
      requestRelayout();
    },
    [setSchema, requestRelayout],
  );

  const swapLanes = useCallback(
    async (laneIdA: string, laneIdB: string) => {
      const orderA = schema.lanes.find((l) => l.id === laneIdA)?.order;
      const orderB = schema.lanes.find((l) => l.id === laneIdB)?.order;
      if (orderA === undefined || orderB === undefined) return;

      const newSchema: FlowChartSchema = {
        ...schema,
        lanes: schema.lanes.map((lane) => {
          if (lane.id === laneIdA) return { ...lane, order: orderB };
          if (lane.id === laneIdB) return { ...lane, order: orderA };
          return lane;
        }),
      };

      const newLayout = await calculateLayout(newSchema);
      const newSizes = computeAllSizes(newSchema);
      const finalSchema = { ...newSchema, layout: newLayout };

      setNodes(schemaToRFNodes(finalSchema, newLayout, newSizes));
      setEdges(schemaToRFEdges(finalSchema, newLayout));
      setLayoutState(newLayout);
      setLaneBoundaries(calculateLaneDividers(newLayout.positions, finalSchema, newSizes));
      setPhaseBoundaries(calculatePhaseDividers(newLayout.positions, finalSchema, newSizes));
      setSchema(finalSchema);
    },
    [schema, setSchema, setNodes, setEdges],
  );

  // ---- Lane CRUD ----

  const addLane = useCallback(
    (afterLaneId?: string) => {
      updateSchema((prev) => {
        const maxOrder = Math.max(0, ...prev.lanes.map((l) => l.order));
        let insertOrder: number;
        if (afterLaneId) {
          const ref = prev.lanes.find((l) => l.id === afterLaneId);
          insertOrder = ref ? ref.order + 1 : maxOrder + 1;
        } else {
          insertOrder = maxOrder + 1;
        }
        const shifted = prev.lanes.map((l) =>
          l.order >= insertOrder ? { ...l, order: l.order + 1 } : l,
        );
        return {
          ...prev,
          lanes: [
            ...shifted,
            { id: generateId("lane"), label: "新規レーン", order: insertOrder },
          ],
        };
      });
    },
    [updateSchema],
  );

  const renameLane = useCallback(
    (laneId: string, label: string) => {
      updateSchema((prev) => ({
        ...prev,
        lanes: prev.lanes.map((l) => (l.id === laneId ? { ...l, label } : l)),
      }));
    },
    [updateSchema],
  );

  const removeLane = useCallback(
    (laneId: string, mergeIntoLaneId: string) => {
      updateSchema((prev) => ({
        ...prev,
        lanes: prev.lanes.filter((l) => l.id !== laneId),
        nodes: prev.nodes.map((n) =>
          n.lane === laneId ? { ...n, lane: mergeIntoLaneId } : n,
        ),
      }));
    },
    [updateSchema],
  );

  // ---- Phase CRUD ----

  const addPhase = useCallback(
    (afterPhaseId?: string) => {
      updateSchema((prev) => {
        const maxOrder = Math.max(-1, ...prev.phases.map((p) => p.order));
        let insertOrder: number;
        if (afterPhaseId) {
          const ref = prev.phases.find((p) => p.id === afterPhaseId);
          insertOrder = ref ? ref.order + 1 : maxOrder + 1;
        } else {
          insertOrder = maxOrder + 1;
        }
        const shifted = prev.phases.map((p) =>
          p.order >= insertOrder ? { ...p, order: p.order + 1 } : p,
        );
        return {
          ...prev,
          phases: [
            ...shifted,
            { id: generateId("phase"), label: "新規フェーズ", order: insertOrder },
          ],
        };
      });
    },
    [updateSchema],
  );

  const renamePhase = useCallback(
    (phaseId: string, label: string) => {
      updateSchema((prev) => ({
        ...prev,
        phases: prev.phases.map((p) => (p.id === phaseId ? { ...p, label } : p)),
      }));
    },
    [updateSchema],
  );

  const removePhase = useCallback(
    (phaseId: string, mergeIntoPhaseId: string | null) => {
      updateSchema((prev) => ({
        ...prev,
        phases: prev.phases.filter((p) => p.id !== phaseId),
        nodes: prev.nodes.map((n) =>
          n.phase === phaseId ? { ...n, phase: mergeIntoPhaseId } : n,
        ),
      }));
    },
    [updateSchema],
  );

  const swapPhases = useCallback(
    async (phaseIdA: string, phaseIdB: string) => {
      const orderA = schema.phases.find((p) => p.id === phaseIdA)?.order;
      const orderB = schema.phases.find((p) => p.id === phaseIdB)?.order;
      if (orderA === undefined || orderB === undefined) return;

      const newSchema: FlowChartSchema = {
        ...schema,
        phases: schema.phases.map((p) => {
          if (p.id === phaseIdA) return { ...p, order: orderB };
          if (p.id === phaseIdB) return { ...p, order: orderA };
          return p;
        }),
      };

      const newLayout = await calculateLayout(newSchema);
      const newSizes = computeAllSizes(newSchema);
      const finalSchema = { ...newSchema, layout: newLayout };

      setNodes(schemaToRFNodes(finalSchema, newLayout, newSizes));
      setEdges(schemaToRFEdges(finalSchema, newLayout));
      setLayoutState(newLayout);
      setLaneBoundaries(calculateLaneDividers(newLayout.positions, finalSchema, newSizes));
      setPhaseBoundaries(calculatePhaseDividers(newLayout.positions, finalSchema, newSizes));
      setSchema(finalSchema);
    },
    [schema, setSchema, setNodes, setEdges],
  );

  const addNode = useCallback(
    (nodeType: NodeType) => {
      const id = generateId("n");
      const defaultLane = schema.lanes[0]?.id ?? "lane-default";
      const labelMap: Record<NodeType, string> = {
        start: "開始",
        end: "終了",
        process: "新規処理",
        decision: "判断",
        data: "データ",
        manual: "手動処理",
        reference: "参照",
      };

      const newNode = {
        id,
        type: nodeType,
        label: labelMap[nodeType] ?? "新規ノード",
        sublabel: null,
        lane: defaultLane,
        phase: null,
        style: "default" as const,
        comments: [],
        decisionMeta:
          nodeType === "decision"
            ? { branchNumber: 1, yesDirection: "down" as const, noDirection: "right" as const }
            : null,
        referenceTargetId: null,
        timeLabel: null,
      };

      updateSchema((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
    },
    [schema.lanes, updateSchema],
  );

  return {
    nodes,
    edges,
    onNodesChange: onNodesChange as OnNodesChange,
    onEdgesChange: onEdgesChange as OnEdgesChange,
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
  };
}
