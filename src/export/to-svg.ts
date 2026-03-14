import type { FlowChartSchema, FlowLayout, FlowNode } from "../types/schema.ts";
import type { ShapeSize } from "../layout/sizing.ts";
import type { PhaseBoundary } from "../layout/types.ts";
import { COLORS, FONT_FAMILY, ARROW_GAP, LANE, FONT, PHASE } from "../layout/constants.ts";
import { calculateLaneDividers, calculatePhaseDividers } from "../layout/engine.ts";

const HEADER_MARGIN = 10;

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

  // Edges — all orthogonal (right-angle) routing
  parts.push(`<!-- ====== Edges ====== -->`);
  for (const edge of schema.edges) {
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];
    const srcSize = sizes.get(edge.source);
    const tgtSize = sizes.get(edge.target);
    const srcNode = schema.nodes.find((n) => n.id === edge.source);
    const tgtNode = schema.nodes.find((n) => n.id === edge.target);
    if (!srcPos || !tgtPos || !srcSize || !tgtSize || !srcNode || !tgtNode) continue;

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

    const { halfW: srcHW, halfH: srcHH } = getHalfSize(srcNode, srcSize);
    const { halfW: tgtHW, halfH: tgtHH } = getHalfSize(tgtNode, tgtSize);

    const dx = tgtPos.x - srcPos.x;
    const dy = tgtPos.y - srcPos.y;

    // Determine if primarily horizontal or vertical routing
    const useHorizontal =
      edge.type === "no" ||
      (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dy) < srcHH + tgtHH);

    const attrs = `stroke="${strokeColor}" stroke-width="${strokeWidth}"${dash} ${markerEnd}`;

    if (useHorizontal) {
      const goRight = dx > 0;
      const x1 = goRight
        ? srcPos.x + srcHW + ARROW_GAP.start
        : srcPos.x - srcHW - ARROW_GAP.start;
      const x2 = goRight
        ? tgtPos.x - tgtHW - ARROW_GAP.end - ARROW_GAP.marker
        : tgtPos.x + tgtHW + ARROW_GAP.end + ARROW_GAP.marker;
      const y1 = srcPos.y;
      const y2 = tgtPos.y;

      if (Math.abs(y1 - y2) < 1) {
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`);
      } else {
        const midX = (x1 + x2) / 2;
        parts.push(
          `<polyline points="${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}" fill="none" ${attrs}/>`,
        );
      }
    } else {
      const goDown = dy >= 0;
      const y1 = goDown
        ? srcPos.y + srcHH + ARROW_GAP.start
        : srcPos.y - srcHH - ARROW_GAP.start;
      const y2 = goDown
        ? tgtPos.y - tgtHH - ARROW_GAP.end - ARROW_GAP.marker
        : tgtPos.y + tgtHH + ARROW_GAP.end + ARROW_GAP.marker;
      const x1 = srcPos.x;
      const x2 = tgtPos.x;

      if (Math.abs(x1 - x2) < 1) {
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`);
      } else {
        let midY = (y1 + y2) / 2;
        const adjusted = avoidPhaseHeaders(midY, phaseBounds);
        if (adjusted !== null) midY = adjusted;
        parts.push(
          `<polyline points="${x1},${y1} ${x1},${midY} ${x2},${midY} ${x2},${y2}" fill="none" ${attrs}/>`,
        );
      }
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
