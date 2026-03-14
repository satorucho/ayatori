import type { FlowChartSchema, FlowLayout, FlowNode } from "../types/schema.ts";
import type { ShapeSize } from "../layout/sizing.ts";
import type { PhaseBoundary } from "../layout/types.ts";
import { COLORS, FONT_FAMILY, ARROW_GAP, LANE, FONT, PHASE } from "../layout/constants.ts";
import { calculateLaneDividers, calculatePhaseDividers } from "../layout/engine.ts";
import { resolveHandles, getConnectionPoint } from "../layout/edge-routing.ts";
import type { HandlePosition } from "../layout/edge-routing.ts";

const HEADER_MARGIN = 10;
/** Extra offset for bypass paths beyond the rightmost/leftmost node edge */
const BYPASS_OFFSET = 30;

function avoidPhaseHeaders(
  midY: number,
  phaseBounds: PhaseBoundary[],
): number | null {
  for (const pb of phaseBounds) {
    const headerTop = pb.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
    const headerBottom = headerTop + PHASE.headerHeight;
    if (midY >= headerTop - HEADER_MARGIN && midY <= headerBottom + HEADER_MARGIN) {
      return headerTop - HEADER_MARGIN;
    }
  }
  return null;
}

function getNodeColors(node: FlowNode) {
  if (node.type === "start" || node.type === "end") return COLORS.startEnd;
  switch (node.style) {
    case "gray":
      return COLORS.gray;
    case "orange":
      return COLORS.orange;
    case "green":
      return COLORS.green;
    case "blue-ref":
      return COLORS["blue-ref"];
    case "hypothesis":
      return COLORS.hypothesis;
    default:
      return COLORS.default;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getHalfSize(node: FlowNode, size: ShapeSize) {
  if (node.type === "decision" || node.type === "start" || node.type === "end") {
    return { halfW: size.width, halfH: size.height };
  }
  return { halfW: size.width / 2, halfH: size.height / 2 };
}

/**
 * Find the rightmost edge of any node in a given lane (for bypass offset).
 */
function getLaneRightEdge(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
  laneId: string,
): number {
  let maxRight = -Infinity;
  for (const node of schema.nodes) {
    if (node.lane !== laneId) continue;
    const pos = layout.positions[node.id];
    const size = sizes.get(node.id);
    if (!pos || !size) continue;
    const { halfW } = getHalfSize(node, size);
    maxRight = Math.max(maxRight, pos.x + halfW);
  }
  return maxRight;
}

export function exportToSVG(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): string {
  const parts: string[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function expand(x: number, y: number, w = 0, h = 0) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  // Pre-compute node bounds
  for (const node of schema.nodes) {
    const pos = layout.positions[node.id];
    const size = sizes.get(node.id);
    if (!pos || !size) continue;
    const { halfW, halfH } = getHalfSize(node, size);
    expand(pos.x - halfW, pos.y - halfH, halfW * 2, halfH * 2);
  }

  // Defs
  parts.push(`<defs>`);
  parts.push(
    `  <marker id="a" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="${COLORS.arrow.default}"/>`);
  parts.push(`  </marker>`);
  parts.push(
    `  <marker id="a-orange" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="${COLORS.arrow.orange}"/>`);
  parts.push(`  </marker>`);
  parts.push(
    `  <marker id="a-green" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="${COLORS.arrow.green}"/>`);
  parts.push(`  </marker>`);
  parts.push(
    `  <marker id="aloop" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="${COLORS.arrow.loop}"/>`);
  parts.push(`  </marker>`);
  parts.push(`</defs>`);

  // Lane headers (computed first for X extent)
  const boundaries = calculateLaneDividers(layout.positions, schema, sizes);
  const phaseBounds = schema.phases.length > 0
    ? calculatePhaseDividers(layout.positions, schema, sizes)
    : [];

  // Phase section headers (horizontal bands)
  if (phaseBounds.length > 0) {
    parts.push(`<!-- ====== Phase Section Headers ====== -->`);

    let bandLeft = LANE.marginLeft;
    let bandRight = maxX;
    if (boundaries.length > 0) {
      bandLeft = boundaries[0].minLeft - LANE.marginLeft + LANE.headerInset;
      bandRight = boundaries[boundaries.length - 1].dividerX - LANE.headerInset;
    }
    const bandWidth = bandRight - bandLeft;

    for (const pb of phaseBounds) {
      const headerY = pb.minTop - PHASE.headerHeight - PHASE.headerPaddingY;
      expand(bandLeft, headerY, bandWidth, PHASE.headerHeight);
      parts.push(
        `<rect x="${bandLeft}" y="${headerY}" width="${bandWidth}" height="${PHASE.headerHeight}" rx="3" fill="${COLORS.phase.fill}" stroke="${COLORS.phase.stroke}" stroke-width="1"/>`,
      );
      parts.push(
        `<text x="${bandLeft + 12}" y="${headerY + PHASE.headerHeight / 2 + 1}" dominant-baseline="central" font-size="${FONT.phase.size}" font-weight="${FONT.phase.weight}" fill="${COLORS.phase.text}">${escapeXml(pb.label)}</text>`,
      );
    }
  }

  if (schema.lanes.length > 1) {
    parts.push(`<!-- ====== Lane Headers ====== -->`);
    const sortedLanes = [...schema.lanes].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedLanes.length; i++) {
      const lane = sortedLanes[i];
      const laneNodes = schema.nodes.filter((n) => n.lane === lane.id);
      if (laneNodes.length === 0) continue;

      const boundary = boundaries.find((b) => b.laneId === lane.id);
      if (!boundary) continue;

      const leftEdge =
        i === 0
          ? boundary.minLeft - LANE.marginLeft
          : (boundaries[i - 1]?.dividerX ?? boundary.minLeft);
      const rightEdge = boundary.dividerX;
      const headerLeft = leftEdge + LANE.headerInset;
      const headerWidth = rightEdge - leftEdge - LANE.headerInset * 2;
      const headerY = minY - 80;

      if (headerWidth <= 0) continue;
      expand(headerLeft, headerY, headerWidth, LANE.headerHeight);

      const cx = headerLeft + headerWidth / 2;
      parts.push(
        `<rect x="${headerLeft}" y="${headerY}" width="${headerWidth}" height="${LANE.headerHeight}" rx="3" fill="${COLORS.laneHeader.fill}"/>`,
      );
      parts.push(
        `<text x="${cx}" y="${headerY + LANE.headerHeight / 2}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.laneHeader.size}" font-weight="${FONT.laneHeader.weight}" fill="${COLORS.laneHeader.text}">${escapeXml(lane.label)}</text>`,
      );
    }
  }

  // Nodes
  parts.push(`<!-- ====== Nodes ====== -->`);
  for (const node of schema.nodes) {
    const pos = layout.positions[node.id];
    const size = sizes.get(node.id);
    if (!pos || !size) continue;

    const colors = getNodeColors(node);
    const cx = pos.x;
    const cy = pos.y;
    const isHypothesis = node.style === "hypothesis";
    const dashAttr = isHypothesis ? ' stroke-dasharray="4,2"' : "";

    if (node.type === "start" || node.type === "end") {
      parts.push(
        `<ellipse cx="${cx}" cy="${cy}" rx="${size.width}" ry="${size.height}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"${dashAttr}/>`,
      );
      if (node.sublabel) {
        parts.push(
          `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
        parts.push(
          `<text x="${cx}" y="${cy + (FONT.nodeMain.size - 2)}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeSub.size}" fill="${COLORS.sub.text}">${escapeXml(node.sublabel)}</text>`,
        );
      } else {
        parts.push(
          `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
      }
    } else if (node.type === "decision") {
      const W = size.width;
      const H = size.height;
      const points = `${cx},${cy - H} ${cx + W},${cy} ${cx},${cy + H} ${cx - W},${cy}`;
      parts.push(
        `<polygon points="${points}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"${dashAttr}/>`,
      );
      const lines = node.label.split("\n");
      if (lines.length === 1) {
        parts.push(
          `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(lines[0])}</text>`,
        );
      } else {
        lines.forEach((line, idx) => {
          const lineY = cy + (idx - (lines.length - 1) / 2) * (FONT.nodeMain.size * 1.25);
          parts.push(
            `<text x="${cx}" y="${lineY}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(line)}</text>`,
          );
        });
      }
    } else {
      const w = size.width;
      const h = size.height;
      const x = cx - w / 2;
      const y = cy - h / 2;
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"${dashAttr}/>`,
      );

      if (node.sublabel) {
        parts.push(
          `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
        parts.push(
          `<text x="${cx}" y="${cy + (FONT.nodeMain.size - 2)}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeSub.size}" fill="${COLORS.sub.text}">${escapeXml(node.sublabel)}</text>`,
        );
      } else {
        parts.push(
          `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${FONT.nodeMain.size}" font-weight="${FONT.nodeMain.weight}" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
      }
    }
  }

  // ====== Edges — handle-based orthogonal routing ======
  parts.push(`<!-- ====== Edges ====== -->`);
  for (const edge of schema.edges) {
    const srcNode = schema.nodes.find((n) => n.id === edge.source);
    const tgtNode = schema.nodes.find((n) => n.id === edge.target);
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];
    const srcSize = sizes.get(edge.source);
    const tgtSize = sizes.get(edge.target);
    if (!srcNode || !tgtNode || !srcPos || !tgtPos || !srcSize || !tgtSize) continue;

    // Resolve handle directions using shared logic
    const { sourceHandle, targetHandle } = resolveHandles(edge, schema, layout);

    // Compute connection points
    const src = getConnectionPoint(srcPos, srcNode, srcSize, sourceHandle);
    const tgt = getConnectionPoint(tgtPos, tgtNode, tgtSize, targetHandle);

    // Apply arrow gaps
    const srcPt = applyGap(src, sourceHandle, ARROW_GAP.start);
    const tgtPt = applyGap(tgt, targetHandle, -(ARROW_GAP.end + ARROW_GAP.marker));

    // Style
    let strokeColor = COLORS.arrow.default;
    let strokeWidth = 1.2;
    let dash = "";
    let markerEnd = 'marker-end="url(#a)"';

    if (edge.type === "loop") {
      strokeColor = COLORS.arrow.loop;
      strokeWidth = 1;
      dash = ' stroke-dasharray="4,2"';
      markerEnd = 'marker-end="url(#aloop)"';
    } else if (edge.type === "hypothesis") {
      strokeColor = "#aaa";
      strokeWidth = 1;
      dash = ' stroke-dasharray="4,2"';
    } else if (edge.type === "merge") {
      strokeWidth = 1;
      markerEnd = "";
    }

    const attrs = `stroke="${strokeColor}" stroke-width="${strokeWidth}"${dash} ${markerEnd}`;

    // Generate the path based on handle combination
    const pathPoints = buildOrthogonalPath(
      srcPt, tgtPt, sourceHandle, targetHandle,
      schema, layout, sizes, srcNode, tgtNode, phaseBounds,
    );

    if (pathPoints.length === 2) {
      parts.push(
        `<line x1="${pathPoints[0].x}" y1="${pathPoints[0].y}" x2="${pathPoints[1].x}" y2="${pathPoints[1].y}" ${attrs}/>`,
      );
    } else {
      const pointStr = pathPoints.map((p) => `${p.x},${p.y}`).join(" ");
      parts.push(`<polyline points="${pointStr}" fill="none" ${attrs}/>`);
    }

    // Expand bounds to include edge paths (especially bypass paths)
    for (const p of pathPoints) {
      expand(p.x, p.y);
    }

    // Edge labels
    if (edge.label) {
      if (edge.type === "yes") {
        const labelX = srcPos.x + 12;
        const labelY =
          (srcNode.type === "decision"
            ? srcPos.y + srcSize.height
            : srcPos.y + srcSize.height / 2) + 15;
        parts.push(
          `<text x="${labelX}" y="${labelY}" font-size="${FONT.edgeLabel.size}" fill="${COLORS.sub.text}">${escapeXml(edge.label)}</text>`,
        );
      } else if (edge.type === "no") {
        const labelX =
          (srcNode.type === "decision"
            ? srcPos.x + srcSize.width
            : srcPos.x + srcSize.width / 2) + 10;
        const labelY = srcPos.y - 7;
        parts.push(
          `<text x="${labelX}" y="${labelY}" font-size="${FONT.edgeLabel.size}" fill="${COLORS.sub.text}">${escapeXml(edge.label)}</text>`,
        );
      }
    }
  }

  // Compute final viewBox with padding
  const padding = 20;
  const vx = Math.floor(minX - padding);
  const vy = Math.floor(minY - padding);
  const vw = Math.ceil(maxX - vx + padding);
  const vh = Math.ceil(maxY - vy + padding);

  const svg = [
    `<svg viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" font-family="${FONT_FAMILY}" xmlns="http://www.w3.org/2000/svg">`,
    ...parts,
    `</svg>`,
  ].join("\n");

  return svg;
}

// ---- Helper functions for edge routing ----

interface Point {
  x: number;
  y: number;
}

/**
 * Apply a gap offset from a connection point in the direction of the handle.
 * Positive gap moves AWAY from the node; negative moves TOWARD the node.
 */
function applyGap(pt: Point, handle: HandlePosition, gap: number): Point {
  switch (handle) {
    case "top":
      return { x: pt.x, y: pt.y - gap };
    case "bottom":
      return { x: pt.x, y: pt.y + gap };
    case "left":
      return { x: pt.x - gap, y: pt.y };
    case "right":
      return { x: pt.x + gap, y: pt.y };
  }
}

/**
 * Build orthogonal path waypoints for an edge based on source/target handles.
 */
function buildOrthogonalPath(
  src: Point,
  tgt: Point,
  srcHandle: HandlePosition,
  tgtHandle: HandlePosition,
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
  srcNode: FlowNode,
  tgtNode: FlowNode,
  phaseBounds: PhaseBoundary[],
): Point[] {
  // bottom → top: vertical flow (possibly with horizontal jog for different X)
  if (srcHandle === "bottom" && tgtHandle === "top") {
    if (Math.abs(src.x - tgt.x) < 1) {
      return [src, tgt];
    }
    // Z-bend: down, horizontal, down
    let midY = (src.y + tgt.y) / 2;
    const adjusted = avoidPhaseHeaders(midY, phaseBounds);
    if (adjusted !== null) midY = adjusted;
    return [
      src,
      { x: src.x, y: midY },
      { x: tgt.x, y: midY },
      tgt,
    ];
  }

  // right → left: horizontal flow (possibly with vertical jog for different Y)
  if (srcHandle === "right" && tgtHandle === "left") {
    if (Math.abs(src.y - tgt.y) < 1) {
      return [src, tgt];
    }
    // U-bend: right, vertical, left
    const midX = (src.x + tgt.x) / 2;
    return [
      src,
      { x: midX, y: src.y },
      { x: midX, y: tgt.y },
      tgt,
    ];
  }

  // right → right: bypass routing (コの字)
  // The path goes: right from source → down → right into target
  if (srcHandle === "right" && tgtHandle === "right") {
    // Find the rightmost edge of the lane for bypass offset
    const laneRight = getLaneRightEdge(schema, layout, sizes, srcNode.lane);
    const bypassX = Math.max(src.x, tgt.x, laneRight) + BYPASS_OFFSET;

    return [
      src,
      { x: bypassX, y: src.y },
      { x: bypassX, y: tgt.y },
      tgt,
    ];
  }

  // left → left: bypass routing (reverse コの字)
  if (srcHandle === "left" && tgtHandle === "left") {
    const laneLeft = src.x; // Approximate
    const bypassX = Math.min(src.x, tgt.x, laneLeft) - BYPASS_OFFSET;

    return [
      src,
      { x: bypassX, y: src.y },
      { x: bypassX, y: tgt.y },
      tgt,
    ];
  }

  // bottom → left: L-shaped
  if (srcHandle === "bottom" && tgtHandle === "left") {
    return [
      src,
      { x: src.x, y: tgt.y },
      tgt,
    ];
  }

  // right → top: L-shaped
  if (srcHandle === "right" && tgtHandle === "top") {
    return [
      src,
      { x: tgt.x, y: src.y },
      tgt,
    ];
  }

  // left → top: L-shaped
  if (srcHandle === "left" && tgtHandle === "top") {
    return [
      src,
      { x: tgt.x, y: src.y },
      tgt,
    ];
  }

  // left → right: horizontal (opposite direction)
  if (srcHandle === "left" && tgtHandle === "right") {
    if (Math.abs(src.y - tgt.y) < 1) {
      return [src, tgt];
    }
    const midX = (src.x + tgt.x) / 2;
    return [
      src,
      { x: midX, y: src.y },
      { x: midX, y: tgt.y },
      tgt,
    ];
  }

  // Fallback: generic two-segment path
  return [
    src,
    { x: src.x, y: tgt.y },
    tgt,
  ];
}
