import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import type { FlowChartSchema } from "../../types/schema.ts";
import type { LaneBoundary, PhaseBoundary } from "../../layout/types.ts";
import { FONT_FAMILY, FONT, PHASE, LANE } from "../../layout/constants.ts";
import { useThemeColors } from "../../theme/useTheme.ts";
import ContextMenu, { type ContextMenuEntry } from "../../components/ContextMenu.tsx";

interface PhaseOverlayProps {
  schema: FlowChartSchema;
  phaseBoundaries: PhaseBoundary[];
  laneBoundaries: LaneBoundary[];
  onAddPhase?: (afterPhaseId?: string) => void;
  onRenamePhase?: (phaseId: string, label: string) => void;
  onRemovePhase?: (phaseId: string, mergeIntoPhaseId: string | null) => void;
  onSwapPhases?: (phaseIdA: string, phaseIdB: string) => void;
}

export default function PhaseOverlay({
  schema,
  phaseBoundaries,
  laneBoundaries,
  onAddPhase,
  onRenamePhase,
  onRemovePhase,
  onSwapPhases,
}: PhaseOverlayProps) {
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const colors = useThemeColors();

  const xExtent = useMemo(() => {
    if (laneBoundaries.length === 0) return null;
    const left =
      laneBoundaries[0].minLeft - LANE.marginLeft + LANE.headerInset;
    const right =
      laneBoundaries[laneBoundaries.length - 1].dividerX - LANE.headerInset;
    return { left, right, width: Math.max(0, right - left) };
  }, [laneBoundaries]);

  // --- Drag state for reordering ---
  const [dragInfo, setDragInfo] = useState<{
    phaseId: string;
    deltaY: number;
  } | null>(null);
  const dragStartYRef = useRef(0);
  const dragPhaseIdRef = useRef<string | null>(null);

  const onSwapPhasesRef = useRef(onSwapPhases);
  onSwapPhasesRef.current = onSwapPhases;
  const phaseBoundariesRef = useRef(phaseBoundaries);
  phaseBoundariesRef.current = phaseBoundaries;

  const dropTarget = useMemo(() => {
    if (!dragInfo) return null;
    const [, , z] = transform;
    const dragged = phaseBoundaries.find((p) => p.phaseId === dragInfo.phaseId);
    if (!dragged) return null;
    const headerY = dragged.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
    const newCenterY = headerY + PHASE.headerHeight / 2 + dragInfo.deltaY / z;

    for (const pb of phaseBoundaries) {
      if (newCenterY <= pb.dividerY) return pb.phaseId;
    }
    return phaseBoundaries[phaseBoundaries.length - 1]?.phaseId ?? null;
  }, [dragInfo, transform, phaseBoundaries]);

  const dropTargetRef = useRef(dropTarget);
  dropTargetRef.current = dropTarget;

  const handlePointerDown = useCallback(
    (phaseId: string, e: React.PointerEvent) => {
      if (!onSwapPhases) return;
      e.stopPropagation();
      e.preventDefault();
      dragStartYRef.current = e.clientY;
      dragPhaseIdRef.current = phaseId;
      setDragInfo({ phaseId, deltaY: 0 });
    },
    [onSwapPhases],
  );

  useEffect(() => {
    if (!dragInfo) return;

    const handleMove = (e: PointerEvent) => {
      const delta = e.clientY - dragStartYRef.current;
      setDragInfo((prev) => (prev ? { ...prev, deltaY: delta } : null));
    };

    const handleUp = () => {
      const phaseId = dragPhaseIdRef.current;
      const target = dropTargetRef.current;
      if (phaseId && target && target !== phaseId) {
        onSwapPhasesRef.current?.(phaseId, target);
      }
      dragPhaseIdRef.current = null;
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
    phaseId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (phaseId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ phaseId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // --- Inline editing ---
  const [editing, setEditing] = useState<{
    phaseId: string;
    value: string;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const startEditing = useCallback(
    (phaseId: string) => {
      const phase = schema.phases.find((p) => p.id === phaseId);
      const pb = phaseBoundaries.find((p) => p.phaseId === phaseId);
      if (!phase || !pb || !xExtent) return;

      const containerRect = svgRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const [tx, ty, z] = transform;
      const headerY = pb.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
      const sx = xExtent.left * z + tx + containerRect.left;
      const sy = headerY * z + ty + containerRect.top;
      const sw = xExtent.width * z;

      setEditing({
        phaseId,
        value: phase.label,
        x: sx + 8,
        y: sy,
        width: sw - 16,
      });
    },
    [schema.phases, phaseBoundaries, xExtent, transform],
  );

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const commitEdit = useCallback(() => {
    if (editing && editing.value.trim() && onRenamePhase) {
      onRenamePhase(editing.phaseId, editing.value.trim());
    }
    setEditing(null);
  }, [editing, onRenamePhase]);

  const handleDoubleClick = useCallback(
    (phaseId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      startEditing(phaseId);
    },
    [startEditing],
  );

  const buildMenuItems = useCallback(
    (phaseId: string): ContextMenuEntry[] => {
      const sorted = [...schema.phases].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((p) => p.id === phaseId);
      const items: ContextMenuEntry[] = [
        {
          label: "ラベルを変更…",
          onClick: () => startEditing(phaseId),
        },
        { type: "divider" },
        {
          label: "上に追加",
          onClick: () => {
            const prev = sorted[idx - 1];
            onAddPhase?.(prev?.id);
          },
        },
        {
          label: "下に追加",
          onClick: () => onAddPhase?.(phaseId),
        },
      ];

      if (sorted.length > 1) {
        items.push({ type: "divider" });
        {
          const prev = sorted[idx - 1];
          const next = sorted[idx + 1];
          if (prev) {
            items.push({
              label: `上に移動`,
              onClick: () => onSwapPhases?.(phaseId, prev.id),
            });
          }
          if (next) {
            items.push({
              label: `下に移動`,
              onClick: () => onSwapPhases?.(phaseId, next.id),
            });
          }
        }
        items.push({ type: "divider" });
        const others = sorted.filter((p) => p.id !== phaseId);
        for (const other of others) {
          items.push({
            label: `「${other.label}」に統合`,
            onClick: () => onRemovePhase?.(phaseId, other.id),
          });
        }
        items.push({
          label: "フェーズを解除（ノード残す）",
          danger: true,
          onClick: () => onRemovePhase?.(phaseId, null),
        });
      } else {
        items.push({ type: "divider" });
        items.push({
          label: "フェーズを解除（ノード残す）",
          danger: true,
          onClick: () => onRemovePhase?.(phaseId, null),
        });
      }

      return items;
    },
    [schema.phases, onAddPhase, onRemovePhase, onSwapPhases, startEditing],
  );

  if (
    schema.phases.length === 0 ||
    phaseBoundaries.length === 0 ||
    !xExtent
  )
    return null;

  const [tx, ty, zoom] = transform;

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
          zIndex: 10,
        }}
      >
        <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
          {phaseBoundaries.map((bounds, i) => {
            const headerY =
              bounds.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
            const bandLeft = xExtent.left;
            const bandWidth = xExtent.width;
            const isDragging = dragInfo?.phaseId === bounds.phaseId;
            const isDropTarget =
              dragInfo !== null &&
              dragInfo.phaseId !== bounds.phaseId &&
              dropTarget === bounds.phaseId;
            const offsetY = isDragging ? dragInfo.deltaY / zoom : 0;
            const isEditing = editing?.phaseId === bounds.phaseId;

            return (
              <g
                key={bounds.phaseId}
                transform={isDragging ? `translate(0, ${offsetY})` : undefined}
                opacity={isDragging ? 0.75 : 1}
              >
                <rect
                  x={bandLeft}
                  y={headerY}
                  width={bandWidth}
                  height={PHASE.headerHeight}
                  rx={3}
                  fill={isDropTarget ? "#3b82f6" : colors.phase.fill}
                  stroke={isDropTarget ? "#3b82f6" : colors.phase.stroke}
                  strokeWidth={1}
                  style={{
                    pointerEvents: "all",
                    cursor: onSwapPhases ? "grab" : "default",
                  }}
                  onPointerDown={(e) => handlePointerDown(bounds.phaseId, e)}
                  onContextMenu={(e) => handleContextMenu(bounds.phaseId, e)}
                  onDoubleClick={(e) => handleDoubleClick(bounds.phaseId, e)}
                />
                {!isEditing && (
                  <text
                    x={bandLeft + 12}
                    y={headerY + PHASE.headerHeight / 2}
                    dominantBaseline="central"
                    fill={colors.phase.text}
                    fontSize={FONT.phase.size}
                    fontWeight={FONT.phase.weight}
                    fontFamily={FONT_FAMILY}
                    style={{ pointerEvents: "none" }}
                  >
                    {bounds.label}
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
          items={buildMenuItems(ctxMenu.phaseId)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {editing &&
        createPortal(
          <input
            ref={editInputRef}
            className="fixed z-[9999] border border-blue-500 rounded outline-none"
            style={{
              left: editing.x,
              top: editing.y,
              width: editing.width,
              height: PHASE.headerHeight * transform[2],
              fontSize: FONT.phase.size * transform[2],
              fontWeight: FONT.phase.weight,
              fontFamily: FONT_FAMILY,
              background: colors.phase.fill,
              color: colors.phase.text,
              padding: 0,
              paddingLeft: 4,
              lineHeight: `${PHASE.headerHeight * transform[2]}px`,
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
