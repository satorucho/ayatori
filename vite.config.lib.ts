import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

/**
 * Plugin to inject CSS directly into the IIFE JS bundle.
 * After build, reads the generated CSS file and prepends a style-injector
 * to the JS file, then removes the CSS file.
 */
function inlineCssPlugin(): Plugin {
  return {
    name: "inline-css",
    closeBundle() {
      const cssPath = resolve(__dirname, "dist-lib/ayatori.css");
      const jsPath = resolve(__dirname, "dist-lib/ayatori.iife.js");

      try {
        const css = readFileSync(cssPath, "utf-8");
        const js = readFileSync(jsPath, "utf-8");

        // Escape CSS for injection
        const escapedCss = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
        const injector = `(function(){var s=document.createElement("style");s.textContent=\`${escapedCss}\`;document.head.appendChild(s)})();\n`;

        writeFileSync(jsPath, injector + js);
        unlinkSync(cssPath);
      } catch {
        // CSS file may not exist if no CSS was generated
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCssPlugin()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib-entry.tsx"),
      name: "Ayatori",
      fileName: "ayatori",
      formats: ["iife"],
    },
    outDir: "dist-lib",
    cssCodeSplit: false,
    minify: true,
    rollupOptions: {
      output: {
        assetFileNames: "ayatori.[ext]",
      },
    },
  },
});
