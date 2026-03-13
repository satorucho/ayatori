import type { FlowChartSchema, FlowLayout } from "../types/schema.ts";
import type { ShapeSize } from "../layout/sizing.ts";
import { exportToSVG } from "./to-svg.ts";

export function exportToHTML(
  schema: FlowChartSchema,
  layout: FlowLayout,
  sizes: Map<string, ShapeSize>,
): string {
  const svgString = exportToSVG(schema, layout, sizes);
  const meta = schema.meta;

  const legendItems: string[] = [];
  const usedTypes = new Set(schema.nodes.map((n) => n.type));

  if (usedTypes.has("start") || usedTypes.has("end")) {
    legendItems.push(
      `<div class="legend-item"><svg width="36" height="22"><ellipse cx="18" cy="11" rx="16" ry="9" fill="#f5f5f5" stroke="#222" stroke-width="1.3"/></svg>開始/完了</div>`,
    );
  }
  if (usedTypes.has("process")) {
    legendItems.push(
      `<div class="legend-item"><svg width="36" height="22"><rect x="1" y="1" width="34" height="20" rx="3" fill="#fff" stroke="#222" stroke-width="1.3"/></svg>処理</div>`,
    );
  }
  if (usedTypes.has("decision")) {
    legendItems.push(
      `<div class="legend-item"><svg width="28" height="28"><polygon points="14,2 26,14 14,26 2,14" fill="#fff" stroke="#222" stroke-width="1.3"/></svg>分岐</div>`,
    );
  }
  if (usedTypes.has("data")) {
    legendItems.push(
      `<div class="legend-item"><svg width="36" height="22"><rect x="1" y="1" width="34" height="20" rx="3" fill="#eee" stroke="#222" stroke-width="1.3"/></svg>データ/システム</div>`,
    );
  }
  if (usedTypes.has("manual")) {
    legendItems.push(
      `<div class="legend-item"><svg width="36" height="22"><rect x="1" y="1" width="34" height="20" rx="3" fill="#fff4e5" stroke="#c87800" stroke-width="1.3"/></svg>手作業・課題</div>`,
    );
  }

  const notes: string[] = [];
  if (schema.designNotes.length > 0) {
    notes.push(
      `<strong>設計判断メモ:</strong><br>${schema.designNotes.join("<br>")}`,
    );
  }
  if (schema.openQuestions.length > 0) {
    notes.push(
      `<strong>要確認事項:</strong><br>${schema.openQuestions.join("<br>")}`,
    );
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap" rel="stylesheet">
<title>${meta.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans JP', 'Helvetica Neue', 'Hiragino Sans', Meiryo, sans-serif; background: #fff; color: #222; padding: 32px 20px; }
  .container { max-width: 100%; margin: 0 auto; }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 24px; font-size: 14px; color: #555; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .flowchart { width: 100%; }
  .note { background: #f9f9f9; border-left: 3px solid #999; padding: 10px 14px; font-size: 14px; color: #555; margin-top: 12px; margin-bottom: 20px; line-height: 1.7; }
  .note-warn { border-left-color: #c87800; }
  .note strong { color: #222; }
  .confidential { text-align: center; font-size: 12px; color: #bbb; margin-top: 20px; letter-spacing: 2px; }
</style>
</head>
<body>
<div class="container">
  <h1>${meta.name}</h1>
  <p class="subtitle">${meta.subtitle ?? meta.purpose}｜${meta.version}</p>
  <div class="legend">${legendItems.join("\n    ")}</div>
  <div class="flowchart">
    ${svgString}
  </div>
  ${notes.length > 0 ? `<div class="note">${notes.join("<br><br>")}</div>` : ""}
  <p class="confidential">CONFIDENTIAL</p>
</div>
</body>
</html>`;
}
