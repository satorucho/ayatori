---
name: ayatori-flow-revise
description: Revise an Ayatori flowchart YAML based on unresolved comments embedded in nodes and edges. Reads comment instructions, applies modifications (rename, add, delete, restyle nodes/edges), marks comments as resolved, and outputs the corrected YAML. Use when given an Ayatori YAML with comments to fix, or asked to process flowchart review feedback.
---

# Ayatori フローチャート修正（コメント反映）

Ayatori の YAML/JSON にはノードやエッジに `comments` フィールドがあり、ユーザーが修正指示を書き込む。このスキルはその未解決コメントを読み取り、指示に従ってフローを修正し、修正済み YAML を出力する。

## コメントの構造

```yaml
comments:
  - id: string          # コメントの一意ID
    author: "user"      # "user" または "ai"
    text: string        # 修正指示テキスト
    resolved: false     # false = 未解決（処理対象）
    createdAt: string   # ISO 8601
```

コメントはノード・エッジの両方に付与できる:

```yaml
nodes:
  - id: n2
    type: process
    label: 申請書を作成する
    lane: lane-applicant
    comments:
      - id: c1
        author: user
        text: "このステップは「申請書を入力する」に名前を変えてください"
        resolved: false
        createdAt: "2026-03-14T10:00:00Z"

edges:
  - id: e3
    source: n3
    target: n4
    type: no
    comments:
      - id: c2
        author: user
        text: "この分岐の先にエラー処理ノードを追加してください"
        resolved: false
        createdAt: "2026-03-14T10:05:00Z"
```

## 処理手順

### Step 1: 未解決コメントを収集

全ノード・全エッジの `comments` から `resolved: false` のものだけを抽出する。`resolved: true` のコメントは無視する。

### Step 2: 各コメントの指示を実行

コメントの `text` に書かれた修正指示を解釈し、フローを変更する。よくある修正パターン:

| 指示の例 | 操作 |
|----------|------|
| 「ラベルを〜に変更」 | `label` / `sublabel` を書き換え |
| 「このノードを削除」 | ノードと関連エッジを削除 |
| 「〜の後に新しいステップを追加」 | 新ノード追加 + エッジの繋ぎ替え |
| 「分岐を追加」 | decision ノード + yes/no エッジを追加 |
| 「レーンを〜に変更」 | `lane` を変更 |
| 「このエッジを削除」 | エッジを削除 |
| 「スタイルをオレンジに」 | `style: orange` を設定 |
| 「サブラベルを追加」 | `sublabel` を設定 |

### Step 3: コメントを resolved にする

修正が完了したコメントの `resolved` を `true` に変更する。**コメント自体は削除しない**（履歴として残す）。

### Step 4: YAML を出力

修正後のフロー全体を YAML で出力する。

## 厳守ルール

1. **`resolved: false` のコメントのみ処理する**
2. **コメントは削除しない**。resolved を true に変えるだけ
3. **layout は書かない**（自動レイアウトが再計算する）
4. **既存ノード/エッジの ID は変更しない**（新規追加分のみ新 ID を振る）
5. **新 ID は既存 ID と衝突しない連番にする**（n100, e100 等、十分大きい番号）
6. **エッジの整合性を保つ**: ノードを削除したら関連エッジも削除。ノードを追加したらエッジで繋ぐ
7. **スキーマ規約に従う**: ノード label は動詞「〜する」、分岐は疑問形、等（ayatori-flow-yaml スキル参照）

## ノード追加時のエッジ繋ぎ替えパターン

「n2 と n3 の間に新ノードを挿入」する場合:

**Before:**
```yaml
edges:
  - id: e2
    source: n2
    target: n3
```

**After:**
```yaml
nodes:
  # ... 既存ノード ...
  - id: n100
    type: process
    label: 新しいステップを実行する
    lane: lane-xxx

edges:
  - id: e2
    source: n2
    target: n100    # 元の e2 の target を新ノードに変更
  - id: e100
    source: n100
    target: n3      # 新エッジで元の target に繋ぐ
```

## ノード削除時のエッジ繋ぎ替えパターン

「n3 を削除」する場合（n2 → n3 → n4 の並び）:

**Before:**
```yaml
edges:
  - id: e2
    source: n2
    target: n3
  - id: e3
    source: n3
    target: n4
```

**After:**
```yaml
# n3 を nodes から削除
# e3 を削除
edges:
  - id: e2
    source: n2
    target: n4    # e2 の target を n4 に繋ぎ替え
```

## AI 応答コメントの追加（任意）

修正時に判断理由や補足を残したい場合、`author: "ai"` のコメントを追加してよい:

```yaml
comments:
  - id: c1
    author: user
    text: "このステップは不要では？"
    resolved: true
    createdAt: "2026-03-14T10:00:00Z"
  - id: c1-reply
    author: ai
    text: "承認フローに必要なため残しましたが、sublabel を追記しました"
    resolved: true
    createdAt: "2026-03-14T12:00:00Z"
```

## 出力例

入力（コメント付き YAML の抜粋）:

```yaml
nodes:
  - id: n2
    type: process
    label: 申請書を作成する
    lane: lane-applicant
    comments:
      - id: c1
        author: user
        text: "「申請フォームに入力する」に変更し、sublabel に「社内ポータル」を追加"
        resolved: false
        createdAt: "2026-03-14T10:00:00Z"
```

出力（修正後）:

```yaml
nodes:
  - id: n2
    type: process
    label: 申請フォームに入力する
    lane: lane-applicant
    sublabel: 社内ポータル
    comments:
      - id: c1
        author: user
        text: "「申請フォームに入力する」に変更し、sublabel に「社内ポータル」を追加"
        resolved: true
        createdAt: "2026-03-14T10:00:00Z"
```

## YAML の書き方

フローの YAML 仕様（ノード種別・エッジ種別・省略ルール等）は [ayatori-flow-yaml](../ayatori-flow-yaml/SKILL.md) スキルを参照。
