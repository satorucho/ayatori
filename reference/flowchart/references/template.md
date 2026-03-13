# テンプレート（構造）

HTML/SVGフローチャートの骨格定義。すべての生成はこのテンプレートから始める。

---

## 1. HTMLテンプレート

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap" rel="stylesheet">
<title>{フロー名称}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans JP', 'Helvetica Neue', 'Hiragino Sans', Meiryo, sans-serif; background: #fff; color: #222; padding: 32px 20px; }
  .container { max-width: 100%; margin: 0 auto; }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 24px; font-size: 14px; color: #555; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .flowchart { width: 100%; }
  .note { background: #f9f9f9; border-left: 3px solid #999; padding: 10px 14px; font-size: 14px; color: #555; margin-top: 12px; margin-bottom: 20px; line-height: 1.7; }
  .note-warn { border-left-color: #c87800; }
  .note strong { color: #222; }
  .confidential { text-align: center; font-size: 12px; color: #bbb; margin-top: 20px; letter-spacing: 2px; }
</style>
</head>
<body>
<div class="container">
  <h1>{フロー名称}</h1>
  <p class="subtitle">{概要説明}｜{日付・バージョン}</p>
  <div class="legend">{凡例}</div>
  <div class="flowchart">
    <svg viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" font-family="'Noto Sans JP', sans-serif">
      <defs>{矢印マーカー}</defs>
      {SVG本体}
    </svg>
  </div>
  <div class="note">{フロー概要・仮説・要確認事項}</div>
  <p class="confidential">CONFIDENTIAL</p>
</div>
</body>
</html>
```

- viewBox幅はフロー内容に応じて調整（単純フロー: 600〜700、複雑フロー: 1200+）
- 高さもフロー内容に応じて調整
- SVG本体には`<!-- ====== セクション名 ====== -->`でコメント区切りを入れる

---

## 2. 矢印マーカー（defs）

```svg
<defs>
  <!-- 標準矢印 -->
  <marker id="a" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
    <polygon points="0 0,7 2.5,0 5" fill="#222"/>
  </marker>
  <!-- 課題矢印（オレンジ） -->
  <marker id="ao" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
    <polygon points="0 0,7 2.5,0 5" fill="#c87800"/>
  </marker>
  <!-- カスタムレーン矢印（例: 緑） -->
  <marker id="ag" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
    <polygon points="0 0,7 2.5,0 5" fill="#2a7a2a"/>
  </marker>
  <!-- ループ戻り矢印 -->
  <marker id="aloop" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
    <polygon points="0 0,7 2.5,0 5" fill="#888"/>
  </marker>
</defs>
```

---

## 3. ノードパーツ

**注意：以下のサイズ値（width, height, rx, ry等）は参考値。実際のサイズはstyle-guide.md §6の計算式で算出する。**

### 3-1. 開始/終了（楕円）
```svg
<ellipse cx="{CX}" cy="{CY}" rx="{§6で計算}" ry="{§6で計算}" fill="#f5f5f5" stroke="#222" stroke-width="1.5"/>
<text x="{CX}" y="{CY+4}" text-anchor="middle" font-size="16" font-weight="600">{ラベル}</text>
```
- 補足テキストがある場合: ryを拡大して2行収容（§6-4参照）
- 上端=CY-ry、下端=CY+ry で座標計算に使う

### 3-2. 処理（角丸矩形）

**2行ラベル（主テキスト+補足テキスト）:**
```svg
<rect x="{X}" y="{Y}" width="{§6で計算}" height="{§6で計算}" rx="3" fill="#fff" stroke="#222" stroke-width="1.5"/>
<text x="{CX}" y="{CY-8}" text-anchor="middle" font-size="16">{主ラベル}</text>
<text x="{CX}" y="{CY+12}" text-anchor="middle" font-size="12" fill="#999">{サブラベル}</text>
```

**1行ラベル:**
```svg
<rect x="{X}" y="{Y}" width="{§6で計算}" height="{§6で計算}" rx="3" fill="#fff" stroke="#222" stroke-width="1.5"/>
<text x="{CX}" y="{CY+5}" text-anchor="middle" font-size="16">{ラベル}</text>
```

### 3-3. 分岐（ダイヤモンド）
```svg
<polygon points="{CX},{TOP} {CX+W},{CY} {CX},{BOTTOM} {CX-W},{CY}" fill="#fff" stroke="#222" stroke-width="1.5"/>
<text x="{CX}" y="{CY-5}" text-anchor="middle" font-size="16" font-weight="600">{問い1行目}</text>
<text x="{CX}" y="{CY+15}" text-anchor="middle" font-size="16" font-weight="600">{問い2行目}</text>
```
- W, Hは§6-4のダイヤモンド計算式で算出
- 上端=CY-H, 下端=CY+H, 左端=CX-W, 右端=CX+W

### 3-4. データ/システム（灰色矩形）
```svg
<rect x="{X}" y="{Y}" width="{§6で計算}" height="{§6で計算}" rx="3" fill="#eee" stroke="#222" stroke-width="1.5"/>
<text x="{CX}" y="{CY-8}" text-anchor="middle" font-size="16">{システム名}</text>
<text x="{CX}" y="{CY+12}" text-anchor="middle" font-size="12" fill="#999">{補足}</text>
```

### 3-5. 手作業・課題（オレンジ矩形）
```svg
<rect x="{X}" y="{Y}" width="{§6で計算}" height="{§6で計算}" rx="3" fill="#fff4e5" stroke="#c87800" stroke-width="1.5"/>
<text x="{CX}" y="{CY-8}" text-anchor="middle" font-size="16" fill="#c87800">{アクター}</text>
<text x="{CX}" y="{CY+12}" text-anchor="middle" font-size="12" fill="#c87800">{作業内容}</text>
```

### 3-6. カスタムレーン（例: 緑）
```svg
<rect x="{X}" y="{Y}" width="{§6で計算}" height="{§6で計算}" rx="3" fill="#e8f4e8" stroke="#2a7a2a" stroke-width="1.5"/>
<text x="{CX}" y="{CY-8}" text-anchor="middle" font-size="16" font-weight="600" fill="#2a7a2a">{主ラベル}</text>
<text x="{CX}" y="{CY+12}" text-anchor="middle" font-size="12" fill="#555">{サブラベル}</text>
```

---

## 4. 接続線パーツ

### 4-1. 矢印付き（次のノードへ接続）
```svg
<!-- 垂直 -->
<line x1="{CX}" y1="{始点Y}" x2="{CX}" y2="{終点Y}" stroke="#222" stroke-width="1.2" marker-end="url(#a)"/>
<!-- 水平 -->
<line x1="{始点X}" y1="{CY}" x2="{終点X}" y2="{CY}" stroke="#222" stroke-width="1.2" marker-end="url(#a)"/>
```

### 4-2. 矢印なし（合流線）
```svg
<!-- 垂直（ダイヤモンドから合流点へ） -->
<line x1="{CX}" y1="{始点Y}" x2="{CX}" y2="{合流Y}" stroke="#222" stroke-width="1.2"/>
<!-- 水平（合流点から合流先へ） -->
<line x1="{開始X}" y1="{合流Y}" x2="{合流先X}" y2="{合流Y}" stroke="#222" stroke-width="1"/>
```

### 4-3. 仮説線（点線）
```svg
<line ... stroke-dasharray="4,2"/>
```

### 4-4. ループ戻り線（点線・灰色）
```svg
<line x1="{始点X}" y1="{始点Y}" x2="{終点X}" y2="{終点Y}" stroke="#888" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#aloop)"/>
```

---

## 5. Yes/Noラベル

**ダイヤモンド直近に配置する。矢印の中間には置かない。**

```svg
<!-- Yes: ダイヤモンド下辺の直下 -->
<text x="{CX+12}" y="{ダイヤモンド下端+15}" font-size="12" fill="#999">Yes</text>

<!-- No: ダイヤモンド右辺の直右 -->
<text x="{ダイヤモンド右端+10}" y="{CY-7}" font-size="12" fill="#999">No</text>
```

---

## 6. 凡例

使用するノード種別のみ含める。

```html
<div class="legend">
  <div class="legend-item"><svg width="36" height="22"><ellipse cx="18" cy="11" rx="16" ry="9" fill="#f5f5f5" stroke="#222" stroke-width="1.3"/></svg>開始/完了</div>
  <div class="legend-item"><svg width="36" height="22"><rect x="1" y="1" width="34" height="20" rx="3" fill="#fff" stroke="#222" stroke-width="1.3"/></svg>処理</div>
  <div class="legend-item"><svg width="28" height="28"><polygon points="14,2 26,14 14,26 2,14" fill="#fff" stroke="#222" stroke-width="1.3"/></svg>分岐</div>
  <div class="legend-item"><svg width="36" height="22"><rect x="1" y="1" width="34" height="20" rx="3" fill="#eee" stroke="#222" stroke-width="1.3"/></svg>データ/システム</div>
</div>
```

---

## 7. タイムゾーン（オプション）

```svg
<rect x="0" y="{Y}" width="{SVG幅}" height="{H}" fill="#fafafa"/>
<line x1="0" y1="{Y}" x2="{SVG幅}" y2="{Y}" stroke="#bbb" stroke-width="1.5" stroke-dasharray="6,3"/>
<text x="16" y="{Y+20}" font-size="16" font-weight="700">{ゾーン名}</text>
<text x="16" y="{Y+36}" font-size="12" fill="#888">{ゾーン説明}</text>
```

---

## 8. レーンヘッダー（オプション）

```svg
<line x1="{X}" y1="{TOP}" x2="{X}" y2="{BOTTOM}" stroke="#ddd" stroke-width="1"/>
<rect x="{X}" y="{Y}" width="{W}" height="50" rx="3" fill="#222"/>
<text x="{CX}" y="{Y+32}" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">{レーン名}</text>
```
