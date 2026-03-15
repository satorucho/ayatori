import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowChartSchema } from "./types/schema.ts";
import { schemaToYaml, yamlToSchema } from "./schema/yaml.ts";
import FlowEditor from "./editor/FlowEditor.tsx";
import { ThemeProvider } from "./theme/ThemeContext.tsx";
import { useTheme } from "./theme/useTheme.ts";

export interface EmbedApi {
  setYaml: (yaml: string) => void;
  getYaml: () => string;
}

export interface AyatoriEmbedProps {
  initialYaml: string;
  editable?: boolean;
  onYamlChange?: (yaml: string) => void;
  theme?: "light" | "dark" | "auto";
  onReady?: (api: EmbedApi) => void;
}

interface ParsedYaml {
  schema: FlowChartSchema;
  normalizedYaml: string;
}

function parseAndNormalizeYaml(input: string): ParsedYaml {
  const schema = yamlToSchema(input);
  const normalizedYaml = schemaToYaml(schema);
  return { schema, normalizedYaml };
}

function ThemeSync({ theme = "auto" }: { theme?: "light" | "dark" | "auto" }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (theme === "auto") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => setTheme(media.matches ? "dark" : "light");
      apply();
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    setTheme(theme);
    return;
  }, [theme, setTheme]);

  return null;
}

function AyatoriEmbedInner({
  initialYaml,
  editable = true,
  onYamlChange,
  onReady,
}: AyatoriEmbedProps) {
  const [schema, setSchema] = useState<FlowChartSchema | null>(null);
  const [currentYaml, setCurrentYaml] = useState("");
  const [baseYaml, setBaseYaml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [pendingBaselineSync, setPendingBaselineSync] = useState(true);
  const currentYamlRef = useRef("");

  const hasChanges = useMemo(
    () => currentYaml.length > 0 && currentYaml !== baseYaml,
    [currentYaml, baseYaml],
  );

  const handleSchemaChange = useCallback(
    (nextSchema: FlowChartSchema) => {
      const normalized = schemaToYaml(nextSchema);
      currentYamlRef.current = normalized;
      setCurrentYaml(normalized);
      if (pendingBaselineSync) {
        setBaseYaml(normalized);
        setPendingBaselineSync(false);
        return;
      }
      onYamlChange?.(normalized);
    },
    [onYamlChange, pendingBaselineSync],
  );

  const loadYamlIntoEditor = useCallback(
    (yaml: string, resetBaseline: boolean) => {
      const parsed = parseAndNormalizeYaml(yaml);
      currentYamlRef.current = parsed.normalizedYaml;
      setSchema(parsed.schema);
      setCurrentYaml(parsed.normalizedYaml);
      if (resetBaseline) {
        setBaseYaml(parsed.normalizedYaml);
        setPendingBaselineSync(true);
      }
      setError(null);
      setEditorKey((prev) => prev + 1);
      return parsed.normalizedYaml;
    },
    [],
  );

  useEffect(() => {
    try {
      loadYamlIntoEditor(initialYaml, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSchema(null);
      currentYamlRef.current = "";
      setCurrentYaml("");
      setBaseYaml("");
      setError(message);
    }
  }, [initialYaml, loadYamlIntoEditor]);

  useEffect(() => {
    if (!onReady) return;

    onReady({
      setYaml: (nextYaml: string) => {
        try {
          loadYamlIntoEditor(nextYaml, true);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        }
      },
      getYaml: () => currentYamlRef.current,
    });
  }, [onReady, loadYamlIntoEditor]);

  return (
    <div className="ayatori-embed-root relative w-full h-full">
      {schema ? (
        <FlowEditor
          key={editorKey}
          initialSchema={schema}
          editable={editable}
          onSchemaChange={handleSchemaChange}
          initialSidebarOpen={editable}
        />
      ) : (
        <div className="h-full flex items-center justify-center p-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20">
          {error ?? "YAMLの読み込みに失敗しました。"}
        </div>
      )}
      {editable && hasChanges && (
        <div className="pointer-events-none absolute top-3 left-3 z-[1300]">
          <div className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/60 shadow-sm">
            編集されています
          </div>
        </div>
      )}
      {error && schema && (
        <div className="pointer-events-none absolute top-3 right-3 z-[1300]">
          <div className="text-xs px-3 py-1.5 rounded border shadow-sm bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

export function AyatoriEmbed(props: AyatoriEmbedProps) {
  return (
    <ThemeProvider>
      <ThemeSync theme={props.theme} />
      <AyatoriEmbedInner {...props} />
    </ThemeProvider>
  );
}
