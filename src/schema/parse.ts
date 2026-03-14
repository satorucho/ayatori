import type { FlowChartSchema } from "../types/schema.ts";
import { hydrateSchema } from "./hydrate.ts";
import { validateSchema } from "./validate.ts";
import { parse } from "yaml";

export type SchemaParseResult =
  | { ok: true; schema: FlowChartSchema }
  | { ok: false; error: string };

function formatValidationErrorMessage(errors: { path: string; message: string }[]): string {
  const preview = errors
    .slice(0, 3)
    .map((err) => `${err.path || "root"}: ${err.message}`)
    .join(" / ");
  return `スキーマ検証に失敗しました: ${preview}`;
}

/**
 * JSON または YAML テキストを読み取り、FlowChartSchema として検証する。
 */
export function parseSchemaText(text: string): SchemaParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "ファイルが空です" };
  }

  let raw: unknown;
  try {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      raw = JSON.parse(trimmed) as unknown;
    } else {
      raw = parse(trimmed) as unknown;
    }
  } catch (err) {
    return {
      ok: false,
      error: `ファイルの解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "ルートはオブジェクト形式である必要があります" };
  }

  const hydrated = hydrateSchema(raw as Record<string, unknown>);
  const validated = validateSchema(hydrated);
  if (!validated.valid) {
    return { ok: false, error: formatValidationErrorMessage(validated.errors) };
  }

  return { ok: true, schema: validated.schema };
}

