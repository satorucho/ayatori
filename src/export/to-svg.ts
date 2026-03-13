import type { FlowChartSchema, FlowLayout, FlowNode } from "../types/schema.ts";
import type { ShapeSize } from "../layout/sizing.ts";
import { COLORS, FONT_FAMILY, ARROW_GAP, LANE, FONT } from "../layout/constants.ts";
import { calculateLaneDividers } from "../layout/engine.ts";

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

export function exportToSVG(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): string {
  const parts: string[] = [];

  let maxRight = 0;
  let maxBottom = 0;

  // Calculate bounds
  for (const node of schema.nodes) {
    const pos = layout.positions[node.id];
    const size = sizes.get(node.id);
    if (!pos || !size) continue;

    let halfW: number, halfH: number;
    if (node.type === "decision" || node.type === "start" || node.type === "end") {
      halfW = size.width;
      halfH = size.height;
    } else {
      halfW = size.width / 2;
      halfH = size.height / 2;
    }

    maxRight = Math.max(maxRight, pos.x + halfW);
    maxBottom = Math.max(maxBottom, pos.y + halfH);
  }

  const svgWidth = Math.ceil((maxRight + LANE.marginRight) / 10) * 10;
  const svgHeight = Math.ceil((maxBottom + LANE.marginBottom) / 10) * 10;

  // Defs
  parts.push(`<defs>`);
  parts.push(
    `  <marker id="a" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="#222"/>`);
  parts.push(`  </marker>`);
  parts.push(
    `  <marker id="aloop" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
  );
  parts.push(`    <polygon points="0 0,7 2.5,0 5" fill="#888"/>`);
  parts.push(`  </marker>`);
  parts.push(`</defs>`);

  // Lane headers
  const boundaries = calculateLaneDividers(layout.positions, schema, sizes);
  if (schema.lanes.length > 1) {
    parts.push(`<!-- ====== Lane Headers ====== -->`);
    const sortedLanes = [...schema.lanes].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedLanes.length; i++) {
      const lane = sortedLanes[i];
      const laneNodes = schema.nodes.filter((n) => n.lane === lane.id);
      if (laneNodes.length === 0) continue;

      const boundary = boundaries.find((b) => b.laneId === lane.id);
      if (!boundary) continue;

      const cx = (boundary.minLeft + boundary.maxRight) / 2;
      parts.push(
        `<rect x="${boundary.minLeft - LANE.headerInset}" y="${LANE.marginTop}" width="${boundary.maxRight - boundary.minLeft + LANE.headerInset * 2}" height="${LANE.headerHeight}" rx="3" fill="${COLORS.laneHeader.fill}"/>`,
      );
      parts.push(
        `<text x="${cx}" y="${LANE.marginTop + 32}" text-anchor="middle" font-size="${FONT.laneHeader.size}" font-weight="${FONT.laneHeader.weight}" fill="${COLORS.laneHeader.text}">${escapeXml(lane.label)}</text>`,
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
      parts.push(
        `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="${colors.text}">${escapeXml(node.label)}</text>`,
      );
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
          `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="${colors.text}">${escapeXml(lines[0])}</text>`,
        );
      } else {
        lines.forEach((line, idx) => {
          const lineY = cy + (idx - (lines.length - 1) / 2) * 20;
          parts.push(
            `<text x="${cx}" y="${lineY + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="${colors.text}">${escapeXml(line)}</text>`,
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
          `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="600" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
        parts.push(
          `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" fill="#999">${escapeXml(node.sublabel)}</text>`,
        );
      } else {
        parts.push(
          `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="${colors.text}">${escapeXml(node.label)}</text>`,
        );
      }
    }
  }

  // Edges
  parts.push(`<!-- ====== Edges ====== -->`);
  for (const edge of schema.edges) {
    const srcPos = layout.positions[edge.source];
    const tgtPos = layout.positions[edge.target];
    const srcSize = sizes.get(edge.source);
    const tgtSize = sizes.get(edge.target);
    const srcNode = schema.nodes.find((n) => n.id === edge.source);
    const tgtNode = schema.nodes.find((n) => n.id === edge.target);
    if (!srcPos || !tgtPos || !srcSize || !tgtSize || !srcNode || !tgtNode) continue;

    let strokeColor = "#222";
    let strokeWidth = 1.2;
    let dash = "";
    let markerEnd = 'marker-end="url(#a)"';

    if (edge.type === "loop") {
      strokeColor = "#888";
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

    // Determine connection direction
    const isHorizontal =
      edge.type === "no" ||
      Math.abs(srcPos.x - tgtPos.x) > Math.abs(srcPos.y - tgtPos.y) * 2;

    if (isHorizontal) {
      const srcRight =
        srcNode.type === "decision"
          ? srcPos.x + srcSize.width
          : srcPos.x + srcSize.width / 2;
      const tgtLeft =
        tgtNode.type === "decision"
          ? tgtPos.x - tgtSize.width
          : tgtPos.x - tgtSize.width / 2;

      const x1 = srcRight + ARROW_GAP.start;
      const x2 = tgtLeft - ARROW_GAP.end - ARROW_GAP.marker;
      const y = srcPos.y;

      parts.push(
        `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${tgtPos.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dash} ${markerEnd}/>`,
      );
    } else {
      const srcBottom =
        srcNode.type === "decision"
          ? srcPos.y + srcSize.height
          : srcNode.type === "start" || srcNode.type === "end"
            ? srcPos.y + srcSize.height
            : srcPos.y + srcSize.height / 2;
      const tgtTop =
        tgtNode.type === "decision"
          ? tgtPos.y - tgtSize.height
          : tgtNode.type === "start" || tgtNode.type === "end"
            ? tgtPos.y - tgtSize.height
            : tgtPos.y - tgtSize.height / 2;

      const y1 = srcBottom + ARROW_GAP.start;
      const y2 = tgtTop - ARROW_GAP.end - ARROW_GAP.marker;

      if (Math.abs(srcPos.x - tgtPos.x) < 5) {
        parts.push(
          `<line x1="${srcPos.x}" y1="${y1}" x2="${tgtPos.x}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dash} ${markerEnd}/>`,
        );
      } else {
        const midY = (y1 + y2) / 2;
        parts.push(
          `<polyline points="${srcPos.x},${y1} ${srcPos.x},${midY} ${tgtPos.x},${midY} ${tgtPos.x},${y2}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dash} ${markerEnd}/>`,
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
          `<text x="${labelX}" y="${labelY}" font-size="12" fill="#999">${escapeXml(edge.label)}</text>`,
        );
      } else if (edge.type === "no") {
        const labelX =
          (srcNode.type === "decision"
            ? srcPos.x + srcSize.width
            : srcPos.x + srcSize.width / 2) + 10;
        const labelY = srcPos.y - 7;
        parts.push(
          `<text x="${labelX}" y="${labelY}" font-size="12" fill="#999">${escapeXml(edge.label)}</text>`,
        );
      }
    }
  }

  const svg = [
    `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" font-family="${FONT_FAMILY}" xmlns="http://www.w3.org/2000/svg">`,
    ...parts,
    `</svg>`,
  ].join("\n");

  return svg;
}
