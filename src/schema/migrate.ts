import type { FlowChartSchema } from "../types/schema.ts";

/**
 * 古いバージョンのスキーマを最新バージョンに移行する。
 * 現在は v1 のみなので、パススルー。
 */
export function migrateSchema(data: unknown): FlowChartSchema {
  const obj = data as Record<string, unknown>;

  if (obj.schemaVersion === "1") {
    return data as FlowChartSchema;
  }

  throw new Error(
    `未対応のスキーマバージョン: ${String(obj.schemaVersion)}`,
  );
}
