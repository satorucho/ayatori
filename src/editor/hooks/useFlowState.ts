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
import { schemaToYaml } from "../../schema/yaml.ts";
import { parseSchemaText } from "../../schema/parse.ts";
import { computeAllSizes, calculateLayout, calculateLaneDividers, calculatePhaseDividers } from "../../layout/engine.ts";
import type { LaneBoundary, PhaseBoundary } from "../../layout/types.ts";
import { generateId } from "../../utils/id.ts";
import { useUndoRedo } from "./useUndoRedo.ts";
import { schemaToReactFlowEdges, schemaToReactFlowNodes } from "../adapters/flow-adapter.ts";
import { getDefaultStyle } from "../../schema/defaults.ts";

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

export type ImportSchemaResult =
  | { ok: true }
  | { ok: false; error: string };

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
  const [relayoutTick, setRelayoutTick] = useState(0);

  const freeDrawModeRef = useRef(freeDrawMode);
  useEffect(() => {
    freeDrawModeRef.current = freeDrawMode;
  }, [freeDrawMode]);

  const requestRelayout = useCallback(() => {
    if (!freeDrawModeRef.current) {
      setRelayoutTick((tick) => tick + 1);
    }
  }, []);

  const setFreeDrawMode = useCallback(
    (on: boolean) => {
      setFreeDrawModeRaw(on);
      freeDrawModeRef.current = on;
      if (!on) setRelayoutTick((tick) => tick + 1);
    },
    [],
  );

  const sizes = useMemo(() => computeAllSizes(schema), [schema]);

  const initialRfNodes = layoutState ? schemaToReactFlowNodes(schema, layoutState, sizes) : [];
  const initialRfEdges = schemaToReactFlowEdges(schema, layoutState);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialRfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialRfEdges);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      const newEdge: Edge = {
        id: generateId("e"),
        source,
        target,
        sourceHandle: connection.sourceHandle ?? "bottom",
        targetHandle: connection.targetHandle ?? "top",
        type: "flowEdge",
        data: {
          edgeType: "normal",
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
            source,
            target,
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
    const newRFNodes = schemaToReactFlowNodes(schema, newLayout, newSizes);
    const newRFEdges = schemaToReactFlowEdges(schema, newLayout);

    setNodes(newRFNodes);
    setEdges(newRFEdges);
    setLaneBoundaries(calculateLaneDividers(newLayout.positions, schema, newSizes));
    setPhaseBoundaries(calculatePhaseDividers(newLayout.positions, schema, newSizes));

    setSchema((prev) => ({ ...prev, layout: newLayout }));
  }, [schema, setSchema, setNodes, setEdges]);

  const runAutoLayoutRef = useRef(runAutoLayout);
  useEffect(() => {
    runAutoLayoutRef.current = runAutoLayout;
  }, [runAutoLayout]);

  useEffect(() => {
    if (relayoutTick === 0) return;
    queueMicrotask(() => {
      void runAutoLayoutRef.current();
    });
  }, [relayoutTick]);

  const updateSchema = useCallback(
    (updater: (prev: FlowChartSchema) => FlowChartSchema) => {
      setSchema((prev) => {
        const next = updater(prev);
        const newSizes = computeAllSizes(next);
        if (next.layout) {
          const newRFNodes = schemaToReactFlowNodes(next, next.layout, newSizes);
          const newRFEdges = schemaToReactFlowEdges(next, next.layout);
          setNodes(newRFNodes);
          setEdges(newRFEdges);
        }
        return next;
      });
      requestRelayout();
    },
    [setSchema, setNodes, setEdges, requestRelayout],
  );

  const exportYAML = useCallback(() => {
    return schemaToYaml(schema);
  }, [schema]);

  const importSchema = useCallback(
    (text: string): ImportSchemaResult => {
      const parsedResult = parseSchemaText(text);
      if (!parsedResult.ok) {
        return { ok: false, error: parsedResult.error };
      }
      const parsed = parsedResult.schema;
      setSchema(parsed);
      if (parsed.layout) {
        setLayoutState(parsed.layout);
        const newSizes = computeAllSizes(parsed);
        setNodes(schemaToReactFlowNodes(parsed, parsed.layout, newSizes));
        setEdges(schemaToReactFlowEdges(parsed, parsed.layout));
        setLaneBoundaries(calculateLaneDividers(parsed.layout.positions, parsed, newSizes));
        setPhaseBoundaries(calculatePhaseDividers(parsed.layout.positions, parsed, newSizes));
      } else {
        setLayoutState(null);
        setNodes([]);
        setEdges([]);
      }
      requestRelayout();
      return { ok: true };
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
      setNodes(schemaToReactFlowNodes(s, s.layout, newSizes));
      setEdges(schemaToReactFlowEdges(s, s.layout));
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
      const isFreeDraw = freeDrawModeRef.current;

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
        const shouldUpdateNode = laneChanged || phaseChanged;

        const nextNodes = shouldUpdateNode
          ? prev.nodes.map((n) =>
              n.id === rfNode.id
                ? {
                    ...n,
                    ...(laneChanged ? { lane: newLane } : {}),
                    ...(phaseChanged ? { phase: newPhase } : {}),
                  }
                : n,
            )
          : prev.nodes;

        if (!isFreeDraw) {
          if (!shouldUpdateNode) return prev;
          return { ...prev, nodes: nextNodes };
        }

        const baseLayout = prev.layout ?? { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } };
        return {
          ...prev,
          nodes: nextNodes,
          layout: {
            ...baseLayout,
            positions: {
              ...baseLayout.positions,
              [rfNode.id]: {
                ...baseLayout.positions[rfNode.id],
                x: centerX,
                y: centerY,
              },
            },
          },
        };
      });

      if (isFreeDraw) {
        setLayoutState((prev) => {
          const baseLayout = prev ?? { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } };
          return {
            ...baseLayout,
            positions: {
              ...baseLayout.positions,
              [rfNode.id]: {
                ...baseLayout.positions[rfNode.id],
                x: centerX,
                y: centerY,
              },
            },
          };
        });
        return;
      }

      // Auto-layout mode: snap back to calculated positions
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

      setNodes(schemaToReactFlowNodes(finalSchema, newLayout, newSizes));
      setEdges(schemaToReactFlowEdges(finalSchema, newLayout));
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

      setNodes(schemaToReactFlowNodes(finalSchema, newLayout, newSizes));
      setEdges(schemaToReactFlowEdges(finalSchema, newLayout));
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
      };

      const newNode = {
        id,
        type: nodeType,
        label: labelMap[nodeType] ?? "新規ノード",
        sublabel: null,
        lane: defaultLane,
        phase: null,
        style: getDefaultStyle(nodeType),
        comments: [],
        decisionMeta:
          nodeType === "decision"
            ? { branchNumber: 1, yesDirection: "down" as const, noDirection: "right" as const }
            : null,
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
  };
}
