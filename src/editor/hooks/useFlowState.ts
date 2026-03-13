import { useState, useCallback, useMemo, useRef } from "react";
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
import { computeAllSizes, calculateLayout, calculateLaneDividers } from "../../layout/engine.ts";
import type { ShapeSize } from "../../layout/sizing.ts";
import type { LaneBoundary } from "../../layout/types.ts";
import { generateId } from "../../utils/id.ts";

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

function resolveHandles(
  edge: FlowChartSchema["edges"][0],
  schema: FlowChartSchema,
  layout: FlowLayout | null,
): { sourceHandle: string; targetHandle: string } {
  // "no" edges: always horizontal (decision right → target left)
  if (edge.type === "no") {
    return { sourceHandle: "right", targetHandle: "left" };
  }

  // "loop" edges: determine by position if available
  if (edge.type === "loop" && layout) {
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];
    if (srcPos && tgtPos) {
      if (tgtPos.y < srcPos.y) {
        return {
          sourceHandle: tgtPos.x > srcPos.x ? "right" : "left",
          targetHandle: tgtPos.x > srcPos.x ? "left" : "right",
        };
      }
    }
  }

  // For normal downward edges: check if the edge would pass through an
  // intermediate node in the same lane. If so, route to the left side
  // to avoid visual overlap / hidden edges.
  if (layout && edge.type !== "loop") {
    const srcNode = schema.nodes.find((n) => n.id === edge.source);
    const tgtNode = schema.nodes.find((n) => n.id === edge.target);
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];

    if (srcNode && tgtNode && srcPos && tgtPos && srcNode.lane === tgtNode.lane) {
      const minY = Math.min(srcPos.y, tgtPos.y);
      const maxY = Math.max(srcPos.y, tgtPos.y);

      const hasIntermediate = schema.nodes.some((n) => {
        if (n.id === edge.source || n.id === edge.target) return false;
        if (n.lane !== srcNode.lane) return false;
        const pos = layout.positions[n.id];
        return pos !== undefined && pos.y > minY + 10 && pos.y < maxY - 10;
      });

      if (hasIntermediate) {
        return { sourceHandle: "left", targetHandle: "left" };
      }
    }
  }

  // normal / yes / merge / hypothesis: always vertical flow
  return { sourceHandle: "bottom", targetHandle: "top" };
}

function schemaToRFEdges(
  schema: FlowChartSchema,
  layout: FlowLayout | null = null,
): Edge[] {
  return schema.edges.map((edge) => {
    const { sourceHandle, targetHandle } = resolveHandles(edge, schema, layout);
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
  const [schema, setSchema] = useState<FlowChartSchema>(initialSchema);
  const [layoutState, setLayoutState] = useState<FlowLayout | null>(
    initialSchema.layout,
  );
  const [laneBoundaries, setLaneBoundaries] = useState<LaneBoundary[]>([]);

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
    },
    [setEdges],
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
    },
    [setEdges],
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

    setSchema((prev) => ({ ...prev, layout: newLayout }));
  }, [schema, setNodes, setEdges]);

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
    },
    [setNodes, setEdges],
  );

  const exportJSON = useCallback(() => {
    return JSON.stringify(schema, null, 2);
  }, [schema]);

  const importJSON = useCallback(
    (json: string) => {
      const parsed = JSON.parse(json) as FlowChartSchema;
      setSchema(parsed);
      if (parsed.layout) {
        setLayoutState(parsed.layout);
        const newSizes = computeAllSizes(parsed);
        setNodes(schemaToRFNodes(parsed, parsed.layout, newSizes));
        setEdges(schemaToRFEdges(parsed, parsed.layout));
      }
    },
    [setNodes, setEdges],
  );

  // Keep a ref to laneBoundaries for use in drag handler
  const laneBoundariesRef = useRef<LaneBoundary[]>(laneBoundaries);
  laneBoundariesRef.current = laneBoundaries;

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, rfNode: Node) => {
      const currentBoundaries = laneBoundariesRef.current;
      if (currentBoundaries.length === 0) return;

      // Get the node's data to determine its render dimensions
      const nodeData = rfNode.data as { shapeWidth?: number; shapeHeight?: number; nodeType?: string };
      const nodeType = nodeData?.nodeType ?? "process";
      let nodeW: number;
      if (nodeType === "decision" || nodeType === "start" || nodeType === "end") {
        nodeW = (nodeData?.shapeWidth ?? 50) * 2;
      } else {
        nodeW = nodeData?.shapeWidth ?? 200;
      }

      // Calculate center X from the ReactFlow node position (which is top-left)
      const centerX = rfNode.position.x + nodeW / 2;

      setSchema((prev) => {
        const newLane = determineLaneFromPosition(centerX, currentBoundaries, prev);
        if (!newLane) return prev;

        const existingNode = prev.nodes.find((n) => n.id === rfNode.id);
        if (!existingNode || existingNode.lane === newLane) return prev;

        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === rfNode.id ? { ...n, lane: newLane } : n,
          ),
        };
      });
    },
    [],
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
    importJSON,
    addNode,
    sizes,
    laneBoundaries,
  };
}
