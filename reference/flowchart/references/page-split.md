# ページ分割（オプション機能）

ユーザーの希望があった場合のみ適用する。自動適用は禁止。

---

## 概要

1つの長大なフローチャートHTMLを、指定されたセクション区切りで複数ページに分割する。
ブラウザの印刷ダイアログでユーザーがScale%を自由に設定できる状態を維持する。

---

## 分割手法

### HTML構造

各ページを `.page` divで囲み、`page-break-after: always` でページ区切りを実現する。

```html
<div class="page">
  <!-- ページ1のタイトル・凡例・SVG -->
</div>
<div class="page">
  <!-- ページ2のタイトル・凡例・SVG -->
</div>
```

### CSS

```css
.page {
  background: #fff;
  margin: 24px auto;
  padding: 32px 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,.15);
  page-break-after: always;
  overflow: hidden;
}
.page:last-child { page-break-after: auto; }

@media print {
  @page { margin: 0; }
  body { background: #fff !important; padding: 0 !important; }
  .page {
    box-shadow: none !important;
    margin: 0 !important;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
}
```

### 禁止事項：`@page` に `size` を指定しない

```css
/* NG — ブラウザの印刷ダイアログからScale設定が消える */
@page { size: A3 portrait; margin: 0; }

/* OK — Scale設定がユーザーに開放される */
@page { margin: 0; }
```

`size` を指定するとブラウザが用紙サイズを固定し、ユーザーのScale%設定UIが無効化される。

---

## SVG分割手順

### 1. 分割ポイントの特定

セクション区切りコメント（例: `<!-- S3区切り -->`）の位置でSVGコンテンツを分割する。

### 2. ページごとのSVG生成

各ページのSVGには以下を含める：

| 要素 | 処理 |
|------|------|
| `<defs>` (marker定義) | 全ページに複製 |
| レーン区切り線 | 全ページに複製（Y2をページ内最大Yに調整） |
| レーンヘッダー | 全ページに複製（Y座標はそのまま） |
| セクションラベル | 各ページの先頭にそのページの最初のセクションラベルを配置 |
| フロー要素 | 該当セクションの要素のみ含める |

### 3. ページ2以降のY座標シフト

ページ2以降のSVG要素は、Y座標を一括シフトして上詰めする。

**シフト量の計算:**
```
Y_OFFSET = (ページ内最初のフロー要素の元Y座標) - (レーンヘッダー下端 + セクションラベル高さ + 余白)
```

**シフト対象の属性:**
- `y`, `y1`, `y2`, `cy` 属性
- `polygon` の `points` 属性内のY座標

**シフト対象外:**
- `ry`, `rx`（半径であり座標ではない）
- `refX`, `refY`（marker内の参照点）
- `markerWidth`, `markerHeight`

### 4. viewBoxの再計算

各ページのSVGは分割後の内容に合わせてviewBox高さを再計算する。

```
viewBox高さ = ページ内最大Y座標 + 余白（60〜100px程度）
```

### 5. ページヘッダー情報

各ページの `.page` div内にはHTML要素として以下を含める：

- `<h1>` — フローチャートタイトル
- `.subtitle` — そのページに含まれるセクション範囲を明記
- `.legend` — 凡例（全ページ共通）

---

## チェックリスト

ページ分割実施後に確認する項目：

- [ ] 各ページのSVG内に `<defs>` が存在するか
- [ ] 各ページにレーンヘッダーが表示されるか
- [ ] ページ2以降のY座標に負の値が存在しないか
- [ ] 全要素がviewBox範囲内に収まっているか
- [ ] `@page` に `size` が指定されていないか（Scale%設定を阻害しないか）
- [ ] `page-break-after: always` が最終ページ以外に適用されているか
- [ ] 印刷プレビューでページ数がユーザー指定通りか
