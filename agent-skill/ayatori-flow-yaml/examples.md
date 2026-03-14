# Ayatori YAML 実例

## 例1: 簡単な承認フロー

6ノード / 5エッジ / 2レーン / 分岐あり。最小構成の参考。

```yaml
meta:
  name: 簡単な承認フロー
  purpose: 申請の承認が完了するまで
  granularity: business
  version: 2026-03-13
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
designNotes:
  - "分岐①を「内容に不備はないか」にした理由: 不備なし（Yes）が多数派のため正常系"
openQuestions:
  - ①差し戻し後の再申請フローが必要か
```

### ポイント

- `style: orange` は n4 だけ。他のノードは type のデフォルトスタイルなので省略
- edge e3, e4 は `type: no` / `type: yes` のみ。`label` は自動付与されるので省略
- edge e1, e2, e5 は normal なので `type` 自体を省略
- 分岐の label は `|-`（リテラルブロック）で改行を表現

---

## 例2: AsIs 管理者と注文者の体験フロー

16ノード / 15エッジ / 2レーン / 3フェーズ / timeLabel あり。複雑なフローの参考。

```yaml
meta:
  name: AsIs 管理者と注文者の体験フロー
  purpose: 弁当注文サービスの導入から月次運用が完了するまで
  granularity: business
  version: 2026-03-13
  subtitle: PF導入→日次運用→月次運用の全体フロー
lanes:
  - id: lane-admin
    label: 管理者
  - id: lane-orderer
    label: 注文者
phases:
  - id: phase-a
    label: Phase A：導入・登録（初回のみ）
  - id: phase-b
    label: Phase B：日次運用（時間軸で進行）
  - id: phase-c
    label: Phase C：月次運用
nodes:
  - id: n-start
    type: start
    label: PF導入
    lane: lane-admin
    phase: phase-a
  - id: n-a1
    type: process
    label: 費用負担パターンを設定する
    lane: lane-admin
    phase: phase-a
  - id: n-a2
    type: process
    label: コード/QRを配布する
    lane: lane-admin
    phase: phase-a
  - id: n-a3
    type: process
    label: ユーザー登録する
    lane: lane-orderer
    phase: phase-a
  - id: n-a4
    type: process
    label: 登録状況を確認・無効化する
    lane: lane-admin
    sublabel: 退職者アカウント無効化含む
    phase: phase-a
  - id: n-b1
    type: process
    label: 休みカレンダーを設定する
    lane: lane-admin
    phase: phase-b
    timeLabel: 2日以上前
  - id: n-b2
    type: process
    label: 事前予約する（仮押さえ）
    lane: lane-orderer
    phase: phase-b
    timeLabel: 2日以上前
  - id: n-b3
    type: process
    label: 注文状況を確認・照合する
    lane: lane-admin
    sublabel: 注文一覧印刷→検品
    phase: phase-b
    timeLabel: 前日
  - id: n-b4
    type: process
    label: 最終確認/前日締切品の確定
    lane: lane-orderer
    phase: phase-b
    timeLabel: 前日
  - id: n-b5
    type: process
    label: 当日注文/最終キャンセル
    lane: lane-orderer
    sublabel: 決済（該当時）
    phase: phase-b
    timeLabel: 当日朝〜締切
  - id: n-b6
    type: manual
    label: 変更・キャンセル
    lane: lane-orderer
    sublabel: PF不可→電話で玉子屋に連絡
    phase: phase-b
    timeLabel: 締切後
  - id: n-b7
    type: process
    label: リマインド/通知を受け取る
    lane: lane-orderer
    phase: phase-b
  - id: n-b-end
    type: end
    label: 弁当受取り
    lane: lane-orderer
    phase: phase-b
  - id: n-c1
    type: process
    label: 請求・利用実績を確認する
    lane: lane-admin
    phase: phase-c
  - id: n-c2
    type: process
    label: 金額を照合する
    lane: lane-admin
    phase: phase-c
  - id: n-c3
    type: process
    label: 注文実績データを抽出する
    lane: lane-admin
    phase: phase-c
edges:
  - id: ea1
    source: n-start
    target: n-a1
  - id: ea2
    source: n-a1
    target: n-a2
  - id: ea3
    source: n-a2
    target: n-a3
  - id: ea4
    source: n-a3
    target: n-a4
  - id: eb1
    source: n-a4
    target: n-b1
  - id: eb2
    source: n-b1
    target: n-b2
  - id: eb3
    source: n-b2
    target: n-b3
  - id: eb4
    source: n-b3
    target: n-b4
  - id: eb5
    source: n-b4
    target: n-b5
  - id: eb6
    source: n-b5
    target: n-b6
  - id: eb7
    source: n-b5
    target: n-b7
  - id: eb8
    source: n-b7
    target: n-b-end
  - id: ec1
    source: n-a4
    target: n-c1
  - id: ec2
    source: n-c1
    target: n-c2
  - id: ec3
    source: n-c2
    target: n-c3
designNotes:
  - Phase A は初回のみ実行。Phase Bは日次、Phase Cは月次
  - 注文者の月次運用は操作なし（テキスト注釈で対応）
openQuestions:
  - 締切後の変更・キャンセルフローの詳細は要確認
```

### ポイント

- `phases` を使って業務を 3 段階に分割。各ノードに `phase` を指定
- `timeLabel` で日次運用の時間帯を表現（「2日以上前」「前日」「当日朝〜締切」「締切後」）
- `subtitle` で meta にフローの概要を補足
- n-b6 は `type: manual`（手作業ステップ）で自動的にオレンジ色になる
- n-a4 から Phase B（n-b1）と Phase C（n-c1）に分岐（並行フロー）
- エッジ ID は `ea1`, `eb1`, `ec1` のようにフェーズごとにプレフィックスを使い分けている
