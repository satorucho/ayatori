import { useRef, useEffect, useCallback, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";
import type { FlowChartSchema } from "../types/schema.ts";
import { schemaToYaml } from "../schema/yaml.ts";
import { useTheme } from "../theme/useTheme.ts";
import type { ImportSchemaResult } from "./hooks/useFlowState.ts";

interface YamlEditorPanelProps {
  schema: FlowChartSchema;
  onImportSchema: (text: string) => ImportSchemaResult;
}

const darkTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#111827", color: "#e5e7eb" },
    ".cm-gutters": { backgroundColor: "#111827", color: "#6b7280", borderRight: "1px solid #374151" },
    ".cm-activeLineGutter": { backgroundColor: "#1f2937" },
    ".cm-activeLine": { backgroundColor: "#1f293780" },
    ".cm-cursor": { borderLeftColor: "#e5e7eb" },
    ".cm-selectionBackground": { backgroundColor: "#374151 !important" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "#374151 !important" },
  },
  { dark: true },
);

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "#ffffff", color: "#1f2937" },
  ".cm-gutters": { backgroundColor: "#f9fafb", color: "#9ca3af", borderRight: "1px solid #e5e7eb" },
  ".cm-activeLineGutter": { backgroundColor: "#f3f4f6" },
  ".cm-activeLine": { backgroundColor: "#f3f4f680" },
});

export default function YamlEditorPanel({ schema, onImportSchema }: YamlEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const { isDark } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const isFocusedRef = useRef(false);
  const suppressSyncRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onImportSchemaRef = useRef(onImportSchema);
  onImportSchemaRef.current = onImportSchema;

  const handleDocChange = useCallback((doc: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      suppressSyncRef.current = true;
      const result = onImportSchemaRef.current(doc);
      if (!result.ok) {
        setError(result.error);
      } else {
        setError(null);
      }
      requestAnimationFrame(() => {
        suppressSyncRef.current = false;
      });
    }, 500);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        handleDocChange(update.state.doc.toString());
      }
      if (update.focusChanged) {
        isFocusedRef.current = update.view.hasFocus;
      }
    });

    const initialYaml = schemaToYaml(schema);

    const state = EditorState.create({
      doc: initialYaml,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        yaml(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        themeCompartment.current.of(isDark ? darkTheme : lightTheme),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartment.current.reconfigure(isDark ? darkTheme : lightTheme),
    });
  }, [isDark]);

  // Canvas → Editor sync
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (suppressSyncRef.current) return;
    if (isFocusedRef.current) return;

    const newYaml = schemaToYaml(schema);
    const currentDoc = view.state.doc.toString();
    if (newYaml === currentDoc) return;

    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: newYaml },
    });
    setError(null);
  }, [schema]);

  return (
    <div className="w-[480px] shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">YAML</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto" />
      {error && (
        <div className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 truncate">
          {error}
        </div>
      )}
    </div>
  );
}
