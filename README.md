# Ayatori

**Ayatori** (あやとり) — 糸で図形を作り、繋ぎ替えて新たな形を紡ぐ日本の遊びに着想を得た、業務フローチャートの双方向エディタ。

JSON Schema で定義された構造化データと、React Flow ベースのビジュアル編集を双方向で同期する。AI との修正ループを前提としたコメント機構を内蔵し、フローチャートの設計→描画→レビューを一気通貫で行える。

---

## 特徴

- **双方向編集** — JSON ⇄ ビジュアルエディタのリアルタイム同期
- **自動レイアウト** — ELK.js による layered アルゴリズムでレーン分離・分岐合流を自動配置
- **4種のノード** — 開始（緑楕円）、終了（二重線楕円）、処理（角丸矩形）、分岐（ダイヤモンド）
- **コメント機構** — ノード/エッジにコメントを付与し、JSON 経由で AI に修正を依頼するワークフローに対応
- **入力検証 + UI通知** — JSON/YAML 読込時にスキーマ検証し、成功/失敗を画面通知
- **キーボード操作** — `⌘/Ctrl+O` 読込 / `⌘/Ctrl+S` 保存 / `⌘/Ctrl+L` 自動レイアウト / `⌘/Ctrl+B` サイドバー開閉
- **3形式エクスポート** — SVG / スタンドアロン HTML / PNG (Retina 対応)
- **日本語ネイティブ** — 全角/半角混在テキストの幅計算、Noto Sans JP フォント

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | React 19 |
| ビルド | Vite 8 |
| 言語 | TypeScript 5 (strict) |
| ダイアグラム UI | @xyflow/react 12 (React Flow) |
| 自動レイアウト | elkjs |
| スタイリング | Tailwind CSS 3 |
| フォント | Noto Sans JP (Google Fonts) |
| テスト | Vitest |

---

## セットアップ

```bash
npm install
npm run dev
```

http://localhost:5173 でエディタが起動する。

### その他のコマンド

```bash
npm run build       # プロダクションビルド
npm run build:lib   # ホスティング用ライブラリビルド (dist-lib/ayatori.iife.js)
npm run preview     # ビルド結果のプレビュー
npm test            # テスト実行
npm run test:watch  # テスト (watch モード)
npm run typecheck   # 型チェック
npm run lint        # ESLint
```

---

## 使い方

### 1. フローを開く

起動後のウェルカム画面から以下のいずれかを選択:

- **新規フローを作成** — 開始→完了の最小構成で開始
- **JSON ファイルを開く** — 既存の FlowChart Schema JSON を読み込む
- **サンプルを読み込む** — 同梱の `simple-flow.json` / `asis-flow.json`

### 2. 編集する

- ノードをドラッグして配置を調整
- ノード/エッジをクリックしてサイドバーでプロパティを編集
- 「自動レイアウト」ボタンで ELK による自動配置を実行
- サイドバーの「コメント」タブでノードにレビューコメントを追加
- ノード/エッジに未解決コメントがある場合、キャンバス上に赤バッジで件数表示
- フリードローON時に移動したノード位置は JSON/YAML 保存後も維持

### 3. エクスポート

ツールバーから 3 形式でエクスポート:

- **SVG** — ベクター画像。印刷・埋め込み向け
- **HTML** — スタンドアロン HTML。ブラウザで開ける完結ファイル
- **PNG** — ラスター画像 (2x Retina 対応)

### 4. AI との修正ループ

1. エディタ上でノードを選択し、コメントを追加
2. 「JSON を保存」で書き出し
3. JSON を AI (Claude 等) に渡して修正を依頼
4. AI が `comments[].resolved: true` にした修正済み JSON を受け取る
5. 「JSON を開く」で読み込み → 未解決コメントのみバッジ表示

---

## FlowChart Schema

すべてのフローは `FlowChartSchema` (v1) で表現される。型定義は `src/types/schema.ts` を参照。

```jsonc
{
  "schemaVersion": "1",
  "meta": { "name": "...", "purpose": "...", "granularity": "business", "version": "2026-03-13" },
  "lanes": [{ "id": "lane-0", "label": "担当者", "order": 0 }],
  "phases": [],
  "nodes": [
    { "id": "n1", "type": "start", "label": "開始", "sublabel": null, "lane": "lane-0", ... }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "type": "normal", "label": null, ... }
  ],
  "layout": null,
  "designNotes": [],
  "openQuestions": []
}
```

`layout` が `null` の場合、エディタ読込時に自動レイアウトが実行される。

---

## プロジェクト構造

```
src/
├── types/schema.ts              # FlowChart Schema 型定義
├── schema/
│   ├── validate.ts              # JSON バリデーション
│   ├── parse.ts                 # JSON/YAML 読込 + 検証
│   ├── defaults.ts              # ノード種別→スタイル自動判定
│   └── migrate.ts               # スキーマバージョン移行
├── layout/
│   ├── constants.ts             # レイアウト定数 (style-guide 準拠)
│   ├── sizing.ts                # テキスト計測・図形サイズ計算
│   ├── engine.ts                # ELK レイアウトエンジン
│   └── types.ts                 # レイアウト内部型
├── editor/
│   ├── FlowEditor.tsx           # メインエディタ
│   ├── Toolbar.tsx              # ツールバー (ファイル操作・エクスポート)
│   ├── Sidebar.tsx              # サイドバー (プロパティ・コメント)
│   ├── nodes/                   # カスタムノード (4種)
│   │   ├── StartEndNode.tsx     # 開始/終了 (楕円)
│   │   ├── ProcessNode.tsx      # 処理 (角丸矩形)
│   │   ├── DecisionNode.tsx     # 分岐 (ダイヤモンド)
│   ├── edges/
│   │   └── FlowEdge.tsx         # カスタムエッジ (6種描画対応)
│   ├── overlays/
│   │   ├── LaneOverlay.tsx      # レーンヘッダー
│   │   ├── PhaseOverlay.tsx     # Phase 帯
│   │   └── CommentBadge.tsx     # コメントバッジ
│   ├── adapters/
│   │   └── flow-adapter.ts      # Schema ⇄ React Flow 変換共通化
│   └── hooks/
│       ├── useFlowState.ts      # Schema ⇄ React Flow 双方向変換
│       ├── useAutoLayout.ts     # ELK レイアウト実行
│       ├── useComments.ts       # コメント管理
│       └── useUndoRedo.ts       # Undo/Redo
├── export/
│   ├── to-svg.ts                # SVG エクスポート
│   ├── to-html.ts               # スタンドアロン HTML エクスポート
│   └── to-png.ts                # PNG エクスポート (Retina 対応)
└── utils/
    ├── text-measure.ts          # 全角/半角テキスト幅計算
    └── id.ts                    # ID 生成
```

---

## テスト

```bash
npm test
```

| テストファイル | 内容 |
|---|---|
| `tests/editor/import-validation.test.tsx` | ツールバー読込時の成功/失敗通知と検証結果の反映 |
| `tests/editor/flow-state-persistence.test.ts` | 手動配置レイアウト（positions/viewport）の永続化検証 |
| `tests/editor/toolbar.shortcuts.test.tsx` | `⌘/Ctrl+S/L/B` ショートカットの動作検証 |
| `tests/layout/engine.test.ts` | レーン配置・短枝配置・縦方向順序のレイアウト検証 |
| `tests/layout/sizing.test.ts` | テキスト幅計算、図形サイズ計算 (全角/半角/混在) |
| `tests/schema/hydrate.test.ts` | hydrate/dehydrate と YAML roundtrip の整合性 |
| `tests/schema/parse.test.ts` | JSON/YAML 読込時の解析・検証エラー処理 |
| `tests/schema/validate.test.ts` | スキーマバリデーション (必須フィールド・参照整合性・ノード種別) |

---

---

## ホスティング用ライブラリ (Claude Artifact 対応)

`npm run build:lib` で、`<script>` タグで読み込める自己完結型バンドルを生成する。

```html
<script src="ayatori.iife.js"></script>
<div id="root" style="width: 100%; height: 100vh;"></div>
<script>
  Ayatori.render({
    container: document.getElementById('root'),
    yaml: '...',  // YAML テキスト
    editable: true,
    theme: 'auto',
  });
</script>
```

機能: ビジュアル表示 / YAML 編集 / YAML ダウンロード / 自動レイアウト / テーマ切り替え

詳細は `agent-skill/ayatori-create-artifact/SKILL.md` を参照。

GitHub Pages にデプロイした場合、埋め込み版のサンプルは `./embed/` で確認できる。

---

## ライセンス

MIT
