import { useState, useCallback, useMemo } from "react";
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
  _schema: FlowChartSchema,
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
