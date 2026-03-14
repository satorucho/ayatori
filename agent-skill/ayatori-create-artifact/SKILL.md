---
name: ayatori-create-artifact
description: Create a Claude Artifact that renders and edits an Ayatori business flowchart. Use when asked to create a visual flowchart artifact, interactive flow diagram, or Ayatori-powered Claude Artifact.
---

# Ayatori Claude Artifact の作成

Ayatori ライブラリを使って、Claude Artifact 内で業務フローチャートを表示・編集・ダウンロードできるインタラクティブなアーティファクトを作成する。

## 仕組み

1. Ayatori の IIFE バンドル (`ayatori.iife.js`) を `<script>` タグで読み込む
2. インラインの YAML でフローチャートを定義する
3. `Ayatori.render()` でコンテナにレンダリングする

バンドルには React、React Flow、ELK.js、YAML パーサー、全ノード/エッジコンポーネント、CSS がすべて含まれている（外部依存なし）。

## ホスティング URL

ビルド済みバンドルは以下のいずれかで配信する:

- GitHub Pages: `https://satorucho.github.io/ayatori/ayatori.iife.js`
- CDN（npm publish 後）: `https://unpkg.com/ayatori/dist-lib/ayatori.iife.js`
- セルフホスト: `dist-lib/ayatori.iife.js` をビルドして任意のサーバーに配置

> **注意**: Claude Artifact では外部スクリプトの読み込みに制限がある。Artifact の `type: "text/html"` で `<script src="...">` が使えない場合は、バンドル全体をインラインで埋め込む必要がある。その場合は `npm run build:lib` で生成された `dist-lib/ayatori.iife.js` の内容を `<script>` タグ内にペーストする。

## Claude Artifact テンプレート

### React (tsx) Artifact

Claude Artifact の `type: "application/vnd.ant.react"` で作成する場合:

```tsx
// Ayatori Flowchart Artifact
// このアーティファクトは Ayatori ライブラリを使って業務フローチャートを
// インタラクティブに表示・編集できる。

import { useEffect, useRef, useState } from "react";

const AYATORI_CDN = "https://satorucho.github.io/ayatori/ayatori.iife.js";

const FLOW_YAML = `
meta:
  name: 簡単な承認フロー
  purpose: 申請の承認が完了するまで
  granularity: business
  version: 2026-03-14
lanes:
  - id: lane-applicant
    label: 申請者
  - id: lane-approver
    label: 承認者
nodes:
  - id: n1
    type: start
    label: 申請開始
    lane: lane-applicant
  - id: n2
    type: process
    label: 申請書を作成する
    lane: lane-applicant
    sublabel: 申請システム
  - id: n3
    type: decision
    label: |-
      内容に
      不備はないか
    lane: lane-approver
    decisionMeta:
      branchNumber: 1
  - id: n4
    type: process
    label: 差し戻す
    lane: lane-approver
    style: orange
  - id: n5
    type: process
    label: 承認する
    lane: lane-approver
    sublabel: 申請システム
  - id: n6
    type: end
    label: 完了
    lane: lane-approver
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
    type: no
  - id: e4
    source: n3
    target: n5
    type: yes
  - id: e5
    source: n5
    target: n6
`;

export default function AyatoriArtifact() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Ayatori library
    if ((window as any).Ayatori) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = AYATORI_CDN;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError("Ayatori ライブラリの読み込みに失敗しました");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const ayatori = (window as any).Ayatori;
    if (!ayatori) return;

    ayatori.render({
      container: containerRef.current,
      yaml: FLOW_YAML.trim(),
      editable: true,
      theme: "auto",
    });
  }, [loaded]);

  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  if (!loaded) return <div style={{ padding: 20 }}>読み込み中...</div>;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
```

### HTML Artifact

Claude Artifact の `type: "text/html"` で作成する場合:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ayatori Flowchart</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://satorucho.github.io/ayatori/ayatori.iife.js"></script>
  <script>
    const yaml = `
meta:
  name: 簡単な承認フロー
  purpose: 申請の承認が完了するまで
  granularity: business
  version: 2026-03-14
lanes:
  - id: lane-applicant
    label: 申請者
nodes:
  - id: n1
    type: start
    label: 開始
    lane: lane-applicant
  - id: n2
    type: process
    label: 処理する
    lane: lane-applicant
  - id: n3
    type: end
    label: 完了
    lane: lane-applicant
edges:
  - id: e1
    source: n1
    target: n2
  - id: e2
    source: n2
    target: n3
`;
    Ayatori.render({
      container: document.getElementById('root'),
      yaml: yaml.trim(),
      editable: true,
      theme: 'auto',
    });
  </script>
</body>
</html>
```

## API リファレンス

### `Ayatori.render(options)`

フローチャートをコンテナにレンダリングする。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `container` | `HTMLElement` | (必須) | レンダリング先のDOM要素 |
| `yaml` | `string` | (必須) | フローチャート定義のYAML文字列 |
| `editable` | `boolean` | `true` | YAML編集モードを有効にするか |
| `onYamlChange` | `(yaml: string) => void` | - | YAML変更時のコールバック |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | テーマ |

**戻り値:** `AyatoriInstance`

```typescript
interface AyatoriInstance {
  setYaml(yaml: string): void;  // YAMLを更新
  getYaml(): string;            // 現在のYAMLを取得
  destroy(): void;              // インスタンスを破棄
}
```

## 機能

ライブラリに含まれる機能:

1. **ビジュアル表示**: React Flow ベースのフローチャート表示（パン/ズーム対応）
2. **YAML 編集**: ツールバーの「YAML編集」ボタンでYAMLテキスト直接編集
3. **YAML ダウンロード**: 「YAMLダウンロード」ボタンで `.yaml` ファイルをダウンロード
4. **自動レイアウト**: ELK.js による自動配置（読み込み時に実行）
5. **レーン/フェーズ表示**: レーンヘッダーとフェーズヘッダーの表示
6. **6種のノード**: 開始/終了（楕円）、処理（角丸矩形）、分岐（ダイヤモンド）、データ（灰色）、手作業（オレンジ）、参照（青）
7. **テーマ**: ライト/ダーク/自動切り替え

## YAML の書き方

フローチャートの YAML 仕様は [ayatori-flow-yaml](../ayatori-flow-yaml/SKILL.md) スキルを参照。

## コンテナのサイズ

コンテナ要素には **明示的な高さ** を設定すること。React Flow は親要素のサイズに基づいてキャンバスを描画する。

```html
<!-- ✅ 良い例: 高さが明示されている -->
<div id="root" style="width: 100%; height: 600px;"></div>

<!-- ✅ 良い例: viewport 全体を使う -->
<div id="root" style="width: 100%; height: 100vh;"></div>

<!-- ❌ 悪い例: 高さがない（表示されない） -->
<div id="root"></div>
```

## ビルド方法

```bash
npm run build:lib
```

出力: `dist-lib/ayatori.iife.js`（CSS インライン済み、全依存バンドル済み）

## 注意事項

- バンドルサイズは約 600KB (gzip)。React, React Flow, ELK.js を含む
- フォントは Google Fonts から読み込まれる（Noto Sans JP）
- Claude Artifact の CSP 制限により、外部スクリプト読み込みが制限される場合がある
- その場合はバンドル内容を直接 `<script>` タグにインラインで配置する
