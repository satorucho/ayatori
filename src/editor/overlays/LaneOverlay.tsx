import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import type { FlowChartSchema } from "../../types/schema.ts";
import type { LaneBoundary } from "../../layout/types.ts";
import { LANE, FONT_FAMILY, FONT } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import ContextMenu, { type ContextMenuEntry } from "../../components/ContextMenu.tsx";

interface LaneOverlayProps {
  schema: FlowChartSchema;
  laneBoundaries: LaneBoundary[];
  onSwapLanes?: (laneIdA: string, laneIdB: string) => void;
  onAddLane?: (afterLaneId?: string) => void;
  onRenameLane?: (laneId: string, label: string) => void;
  onRemoveLane?: (laneId: string, mergeIntoLaneId: string) => void;
}

export default function LaneOverlay({
  schema,
  laneBoundaries,
  onSwapLanes,
  onAddLane,
  onRenameLane,
  onRemoveLane,
}: LaneOverlayProps) {
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const colors = useThemeColors();

  const lanes = useMemo(
    () => [...schema.lanes].sort((a, b) => a.order - b.order),
    [schema.lanes],
  );

  const minY = useMemo(() => {
    if (!schema.layout) return 0;
    const ys = Object.values(schema.layout.positions).map((p) => p.y);
    return ys.length > 0 ? Math.min(...ys) : 0;
  }, [schema.layout]);

  const maxY = useMemo(() => {
    if (!schema.layout) return 1000;
    const ys = Object.values(schema.layout.positions).map((p) => p.y);
    return ys.length > 0 ? Math.max(...ys) : 1000;
  }, [schema.layout]);

  const headerInfos = useMemo(() => {
    return lanes
      .map((lane, i) => {
        const boundary = laneBoundaries.find((b) => b.laneId === lane.id);
        if (!boundary) return null;

        const leftEdge =
          i === 0
            ? boundary.minLeft - LANE.marginLeft
            : (laneBoundaries[i - 1]?.dividerX ?? boundary.minLeft);
        const rightEdge = boundary.dividerX;

        const headerLeft = leftEdge + LANE.headerInset;
        const headerWidth = rightEdge - leftEdge - LANE.headerInset * 2;
        if (headerWidth <= 0) return null;

        return {
          laneId: lane.id,
          label: lane.label,
          headerLeft,
          headerWidth,
          centerX: headerLeft + headerWidth / 2,
        };
      })
      .filter(Boolean) as {
      laneId: string;
      label: string;
      headerLeft: number;
      headerWidth: number;
      centerX: number;
    }[];
  }, [lanes, laneBoundaries]);

  // --- Drag state ---
  const [dragInfo, setDragInfo] = useState<{
    laneId: string;
    deltaX: number;
  } | null>(null);
  const dragStartXRef = useRef(0);
  const dragLaneIdRef = useRef<string | null>(null);
  const dragDeltaRef = useRef(0);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const headerInfosRef = useRef(headerInfos);
  headerInfosRef.current = headerInfos;
  const laneBoundariesRef = useRef(laneBoundaries);
  laneBoundariesRef.current = laneBoundaries;
  const onSwapLanesRef = useRef(onSwapLanes);
  onSwapLanesRef.current = onSwapLanes;

  const dropTarget = useMemo(() => {
    if (!dragInfo) return null;

    const [, , z] = transform;
    const dragged = headerInfos.find((h) => h.laneId === dragInfo.laneId);
    if (!dragged) return null;

    const newCenterX = dragged.centerX + dragInfo.deltaX / z;

    for (const boundary of laneBoundaries) {
      if (newCenterX <= boundary.dividerX) {
        return boundary.laneId;
      }
    }
    return laneBoundaries[laneBoundaries.length - 1]?.laneId ?? null;
  }, [dragInfo, transform, headerInfos, laneBoundaries]);

  const dropTargetRef = useRef(dropTarget);
  dropTargetRef.current = dropTarget;

  const handlePointerDown = useCallback(
    (laneId: string, e: React.PointerEvent) => {
      if (!onSwapLanes) return;
      e.stopPropagation();
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragLaneIdRef.current = laneId;
      dragDeltaRef.current = 0;
      setDragInfo({ laneId, deltaX: 0 });
    },
    [onSwapLanes],
  );

  useEffect(() => {
    if (!dragInfo) return;

    const handleMove = (e: PointerEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      dragDeltaRef.current = delta;
      setDragInfo((prev) => (prev ? { ...prev, deltaX: delta } : null));
    };

    const handleUp = () => {
      const laneId = dragLaneIdRef.current;
      const target = dropTargetRef.current;
      if (laneId && target && target !== laneId) {
        onSwapLanesRef.current?.(laneId, target);
      }
      dragLaneIdRef.current = null;
      dragDeltaRef.current = 0;
      setDragInfo(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragInfo !== null]);

  // --- Context menu ---
  const [ctxMenu, setCtxMenu] = useState<{
    laneId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (laneId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ laneId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // --- Inline editing ---
  const [editing, setEditing] = useState<{
    laneId: string;
    value: string;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const startEditing = useCallback(
    (laneId: string) => {
      const lane = schema.lanes.find((l) => l.id === laneId);
      const info = headerInfos.find((h) => h.laneId === laneId);
      if (!lane || !info) return;

      const containerRect = svgRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const [tx, ty, z] = transform;
      const hY = minY - LANE.headerOffsetY;
      const sx = info.headerLeft * z + tx + containerRect.left;
      const sy = hY * z + ty + containerRect.top;
      const sw = info.headerWidth * z;

      setEditing({
        laneId,
        value: lane.label,
        x: sx,
        y: sy,
        width: sw,
      });
    },
    [schema.lanes, headerInfos, transform, minY],
  );

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const commitEdit = useCallback(() => {
    if (editing && editing.value.trim() && onRenameLane) {
      onRenameLane(editing.laneId, editing.value.trim());
    }
    setEditing(null);
  }, [editing, onRenameLane]);

  const handleDoubleClick = useCallback(
    (laneId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      startEditing(laneId);
    },
    [startEditing],
  );

  const buildMenuItems = useCallback(
    (laneId: string): ContextMenuEntry[] => {
      const lane = schema.lanes.find((l) => l.id === laneId);
      if (!lane) return [];
      const sorted = [...schema.lanes].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === laneId);
      const items: ContextMenuEntry[] = [
        {
          label: "ラベルを変更…",
          onClick: () => startEditing(laneId),
        },
        { type: "divider" },
        {
          label: "左に追加",
          onClick: () => {
            const prev = sorted[idx - 1];
            onAddLane?.(prev?.id);
          },
        },
        {
          label: "右に追加",
          onClick: () => onAddLane?.(laneId),
        },
      ];

      if (sorted.length > 1) {
        items.push({ type: "divider" });
        const others = sorted.filter((l) => l.id !== laneId);
        for (const other of others) {
          items.push({
            label: `「${other.label}」に統合`,
            onClick: () => onRemoveLane?.(laneId, other.id),
          });
        }
        items.push({
          label: "ノードごと削除",
          danger: true,
          onClick: () => {
            const target = others[0];
            if (target) onRemoveLane?.(laneId, target.id);
          },
        });
      }

      return items;
    },
    [schema.lanes, onAddLane, onRemoveLane, startEditing],
  );

  if (lanes.length <= 1 || laneBoundaries.length === 0) return null;

  const [tx, ty, zoom] = transform;
  const headerY = minY - LANE.headerOffsetY;

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          inset: 0,
          width,
          height,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
          {laneBoundaries.map((boundary, i) => {
            if (i >= laneBoundaries.length - 1) return null;

            return (
              <line
                key={`divider-${boundary.laneId}`}
                x1={boundary.dividerX}
                y1={headerY}
                x2={boundary.dividerX}
                y2={maxY + 200}
                stroke={colors.divider}
                strokeWidth={1 / zoom}
                strokeDasharray={`${8 / zoom} ${4 / zoom}`}
              />
            );
          })}

          {headerInfos.map((info) => {
            const isDragging = dragInfo?.laneId === info.laneId;
            const isDropTarget =
              dragInfo !== null &&
              dragInfo.laneId !== info.laneId &&
              dropTarget === info.laneId;

            const offsetX = isDragging ? dragInfo.deltaX / zoom : 0;
            const isEditing = editing?.laneId === info.laneId;

            return (
              <g
                key={info.laneId}
                transform={isDragging ? `translate(${offsetX}, 0)` : undefined}
                opacity={isDragging ? 0.75 : 1}
              >
                <rect
                  x={info.headerLeft}
                  y={headerY}
                  width={info.headerWidth}
                  height={LANE.headerHeight}
                  rx={3}
                  fill={isDropTarget ? "#3b82f6" : colors.laneHeader.fill}
                  style={{
                    pointerEvents: "all",
                    cursor: onSwapLanes ? "grab" : "default",
                  }}
                  onPointerDown={(e) => handlePointerDown(info.laneId, e)}
                  onContextMenu={(e) => handleContextMenu(info.laneId, e)}
                  onDoubleClick={(e) => handleDoubleClick(info.laneId, e)}
                />
                {isDropTarget && (
                  <rect
                    x={info.headerLeft - 2}
                    y={headerY - 2}
                    width={info.headerWidth + 4}
                    height={LANE.headerHeight + 4}
                    rx={5}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                  />
                )}
                {!isEditing && (
                  <text
                    x={info.headerLeft + info.headerWidth / 2}
                    y={headerY + LANE.headerHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={colors.laneHeader.text}
                    fontSize={FONT.laneHeader.size}
                    fontWeight={FONT.laneHeader.weight}
                    fontFamily={FONT_FAMILY}
                    style={{ pointerEvents: "none" }}
                  >
                    {info.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildMenuItems(ctxMenu.laneId)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {editing &&
        createPortal(
          <input
            ref={editInputRef}
            className="fixed z-[9999] border border-blue-500 rounded outline-none text-center"
            style={{
              left: editing.x,
              top: editing.y,
              width: editing.width,
              height: LANE.headerHeight * transform[2],
              fontSize: FONT.laneHeader.size * transform[2],
              fontWeight: FONT.laneHeader.weight,
              fontFamily: FONT_FAMILY,
              background: colors.laneHeader.fill,
              color: colors.laneHeader.text,
              padding: 0,
              lineHeight: `${LANE.headerHeight * transform[2]}px`,
            }}
            value={editing.value}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, value: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={commitEdit}
          />,
          document.body,
        )}
    </>
  );
}
