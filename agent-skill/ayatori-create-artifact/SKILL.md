---
name: ayatori-create-artifact
description: Create a Claude Artifact that renders and edits an Ayatori business flowchart. Use when asked to create a visual flowchart artifact, interactive flow diagram, or Ayatori-powered Claude Artifact.
---

# Ayatori Claude Artifact の作成（最新）

Ayatori の IIFE ライブラリを使って、Claude Artifact 内で業務フローチャートを表示・編集する。

## 現在の埋め込み仕様（重要）

- 埋め込み版は **通常版と同等のフルエディタUI**（メニューバー / サイドバー / YAMLパネル）で動作する。
- `editable: true` のとき、初期YAMLから変更があると左上に **「編集されています」** バナーが表示される。
- `editable: false` のとき、編集操作は無効化され、閲覧専用として動作する。
- `onYamlChange` には、編集結果の **正規化済み YAML** が渡される。

## 仕組み

1. Ayatori の IIFE バンドル（`ayatori.iife.js`）を読み込む
2. YAML文字列を用意する
3. `Ayatori.render()` でコンテナに描画する

バンドルには React / React Flow / ELK.js / YAML パーサー / 必要CSS が含まれる。

## 配布先 URL

- GitHub Pages: `https://satorucho.github.io/ayatori/ayatori.iife.js`
- CDN（npm publish 後）: `https://unpkg.com/ayatori/dist-lib/ayatori.iife.js`
- セルフホスト: `dist-lib/ayatori.iife.js`

> 注意: Claude Artifact の実行環境や CSP により、外部 `<script src="...">` が制限される場合がある。  
> その場合は `npm run build:lib` で生成した `dist-lib/ayatori.iife.js` をインライン `<script>` に埋め込む。

## Claude Artifact テンプレート

### React (tsx) Artifact（推奨）

`type: "application/vnd.ant.react"` 向け。  
インスタンスの `destroy()` まで含めた安全なテンプレート。

```tsx
import { useEffect, useRef, useState } from "react";

const AYATORI_CDN = "https://satorucho.github.io/ayatori/ayatori.iife.js";

const FLOW_YAML = `
meta:
  name: 埋め込みデモ
  purpose: 入力が完了するまで
  granularity: business
  version: 2026-03-15
lanes:
  - id: lane-user
    label: ユーザー
  - id: lane-system
    label: システム
nodes:
  - id: n1
    type: start
    label: 開始
    lane: lane-user
  - id: n2
    type: process
    label: 入力する
    lane: lane-user
  - id: n3
    type: process
    label: 保存する
    lane: lane-system
  - id: n4
    type: end
    label: 完了
    lane: lane-system
edges:
  - id: e1
    source: n1
    target: n2
  - id: e2
    source: n2
    target: n3
  - id: e3
    source: n3
    target: n4
`.trim();

export default function AyatoriArtifact() {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const baseYamlRef = useRef(FLOW_YAML);

  useEffect(() => {
    if ((window as any).Ayatori) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = AYATORI_CDN;
    script.onload = () => setLoaded(true);
    script.onerror = () =>
      setError("Ayatori ライブラリの読み込みに失敗しました");
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const ayatori = (window as any).Ayatori;
    if (!ayatori?.render) {
      setError("Ayatori API が見つかりません");
      return;
    }

    instanceRef.current?.destroy?.();
    instanceRef.current = ayatori.render({
      container: containerRef.current,
      yaml: FLOW_YAML,
      editable: true,
      theme: "auto",
      onYamlChange: (nextYaml: string) => {
        setDirty(nextYaml !== baseYamlRef.current);
      },
    });

    return () => {
      instanceRef.current?.destroy?.();
      instanceRef.current = null;
    };
  }, [loaded]);

  if (error) return <div style={{ padding: 16, color: "crimson" }}>{error}</div>;
  if (!loaded) return <div style={{ padding: 16 }}>読み込み中...</div>;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {dirty && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 20,
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid #f59e0b",
            background: "#fffbeb",
            color: "#92400e",
          }}
        >
          外部ステータス: 編集されています
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
```

### HTML Artifact

`type: "text/html"` 向け。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ayatori Artifact</title>
  <style>
    html, body, #root {
      width: 100%;
      height: 100%;
      margin: 0;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://satorucho.github.io/ayatori/ayatori.iife.js"></script>
  <script>
    const yaml = `
meta:
  name: シンプルフロー
  purpose: 完了するまで
  granularity: business
  version: 2026-03-15
lanes:
  - id: lane-1
    label: 担当者
nodes:
  - id: n1
    type: start
    label: 開始
    lane: lane-1
  - id: n2
    type: process
    label: 作業する
    lane: lane-1
  - id: n3
    type: end
    label: 完了
    lane: lane-1
edges:
  - id: e1
    source: n1
    target: n2
  - id: e2
    source: n2
    target: n3
`.trim();

    Ayatori.render({
      container: document.getElementById("root"),
      yaml,
      editable: true,
      theme: "auto",
    });
  </script>
</body>
</html>
```

## API リファレンス

### `Ayatori.render(options)`

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `container` | `HTMLElement` | 必須 | レンダリング先DOM |
| `yaml` | `string` | 必須 | フローチャートYAML |
| `editable` | `boolean` | `true` | 編集可能モード（`false` で閲覧専用） |
| `onYamlChange` | `(yaml: string) => void` | - | YAML変更通知 |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | テーマ |

戻り値:

```ts
interface AyatoriInstance {
  setYaml(yaml: string): void;
  getYaml(): string;
  destroy(): void;
}
```

## ライブラリに含まれる主機能

1. 通常版同等の編集UI（メニューバー / サイドバー / YAMLパネル）
2. ビジュアル編集（React Flow）
3. YAML編集 / YAML保存
4. 自動レイアウト（ELK.js）
5. レーン / フェーズ編集（追加・名称変更・並び替え・削除）
6. ノード種別（開始 / 終了 / 処理 / 分岐）
7. テーマ切替（light / dark / auto）
8. 初期YAMLとの差分バナー（`editable: true` 時）

## コンテナサイズ（必須）

React Flow は親要素サイズが必要。必ず高さを明示する。

```html
<!-- OK -->
<div id="root" style="width:100%; height:100vh;"></div>

<!-- NG -->
<div id="root"></div>
```

## ビルド

```bash
npm run build:lib
```

出力: `dist-lib/ayatori.iife.js`（CSSインライン済み）

## よくある失敗と対処

- 何も表示されない  
  - `#root` に高さがない可能性が高い。
- ライブラリ読込に失敗する  
  - CSP 制限を疑い、IIFE をインライン埋め込みに切り替える。
- 変更通知を受け取れない  
  - `editable: true` と `onYamlChange` を同時に設定しているか確認する。
- 多重描画・メモリリーク  
  - 再レンダリング時に `instance.destroy()` を呼ぶ。
