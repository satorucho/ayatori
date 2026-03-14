import { stringify, parse } from "yaml";
import type { FlowChartSchema } from "../types/schema.ts";
import { hydrateSchema } from "./hydrate.ts";
import { dehydrateSchema } from "./dehydrate.ts";

/**
 * FlowChartSchema → コンパクト YAML 文字列に変換。
 * デフォルト値と一致するフィールドは省略される。
 */
export function schemaToYaml(schema: FlowChartSchema): string {
  const sparse = dehydrateSchema(schema);
  return stringify(sparse, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
}

/**
 * YAML 文字列 → FlowChartSchema に変換。
 * 省略フィールドは hydrateSchema でデフォルト値が補完される。
 */
export function yamlToSchema(yamlStr: string): FlowChartSchema {
  const parsed = parse(yamlStr) as Record<string, unknown>;
  return hydrateSchema(parsed);
}
