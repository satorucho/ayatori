/**
 * Ayatori Library Entry Point
 *
 * Self-contained IIFE bundle that exposes window.Ayatori for use in
 * Claude Artifacts and other hosted environments.
 *
 * Usage:
 *   <script src="ayatori.iife.js"></script>
 *   <div id="ayatori-root"></div>
 *   <script>
 *     Ayatori.render({
 *       container: document.getElementById('ayatori-root'),
 *       yaml: `meta:\n  name: My Flow\n  ...`,
 *     });
 *   </script>
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { AyatoriEmbed } from "./lib-editor.tsx";

// Import CSS so it gets bundled
import "./lib-tailwind.css";

export interface AyatoriRenderOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** YAML string defining the flowchart */
  yaml: string;
  /** Enable editing (default: true) */
  editable?: boolean;
  /** Callback when YAML changes */
  onYamlChange?: (yaml: string) => void;
  /** Theme: 'light' | 'dark' | 'auto' (default: 'auto') */
  theme?: "light" | "dark" | "auto";
}

export interface AyatoriInstance {
  /** Update the YAML content */
  setYaml: (yaml: string) => void;
  /** Get the current YAML content */
  getYaml: () => string;
  /** Destroy the instance */
  destroy: () => void;
}

function render(options: AyatoriRenderOptions): AyatoriInstance {
  const {
    container,
    yaml,
    editable = true,
    onYamlChange,
    theme = "auto",
  } = options;

  let currentYaml = yaml;
  let setYamlFn: ((yaml: string) => void) | null = null;
  let getYamlFn: (() => string) | null = null;

  const root = createRoot(container);

  function handleYamlChange(newYaml: string) {
    currentYaml = newYaml;
    onYamlChange?.(newYaml);
  }

  root.render(
    React.createElement(AyatoriEmbed, {
      initialYaml: yaml,
      editable,
      onYamlChange: handleYamlChange,
      theme,
      onReady: (api) => {
        setYamlFn = api.setYaml;
        getYamlFn = api.getYaml;
      },
    }),
  );

  return {
    setYaml: (newYaml: string) => {
      currentYaml = newYaml;
      setYamlFn?.(newYaml);
    },
    getYaml: () => getYamlFn?.() ?? currentYaml,
    destroy: () => root.unmount(),
  };
}

// Expose on window
const AyatoriAPI = {
  render,
  version: "1.0.0",
};

// @ts-expect-error Global augmentation
window.Ayatori = AyatoriAPI;

export default AyatoriAPI;
