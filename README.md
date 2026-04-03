# MissionManager for Propagate

部門 > プロジェクト > メインタスク > サブタスクの階層でタスクを管理する Web アプリ。

## CLI

Web の API を叩いてデータを取得する CLI を同梱しています。AI エージェントや自動化スクリプトからも利用できます。

### セットアップ

```bash
npm install       # 依存パッケージをインストール
npm run dev       # 開発サーバーを起動 (http://localhost:3000)
```

### ログイン

```bash
npm run cli login
# Email: your@email.com
# Password: ********
# => ログイン成功: your@email.com
```

セッションは `~/.mmweb-session.json` に保存されます（`chmod 600`）。
本番環境に接続する場合は URL を指定します:

```bash
npm run cli login https://your-app.vercel.app
```

### コマンド一覧

```bash
# 部門一覧
npm run cli departments

# プロジェクト一覧（部門IDを指定）
npm run cli projects <部門ID>

# プロジェクト詳細（メインタスク・サブタスク含む）
npm run cli detail <プロジェクトID>

# 全タスク一覧（未完了のみ）
npm run cli tasks

# 全タスク一覧（完了含む）
npm run cli tasks -- --all

# 期限切れタスク
npm run cli overdue

# タスク検索
npm run cli search <キーワード>

# ログアウト
npm run cli logout
```

### 出力例

```
$ npm run cli departments
abc12345-...  営業部
def67890-...  開発部

$ npm run cli tasks
[1/3]  営業部 > Q2提案 > 提案書作成  期限:2026-04-10  担当:田中
  [ ] ヒアリング
  [ ] ドラフト作成
  [x] 社内レビュー
[0/2]  開発部 > リリース準備 > テスト実施  期限:2026-04-05
  [ ] 結合テスト
  [ ] 受入テスト
```

### AI エージェントからの利用

CLI は標準出力に結果を返すため、シェル実行可能な AI エージェント（Claude Code など）から直接呼び出せます。

```
> npx tsx cli.ts tasks
```

事前に `npm run cli login` でセッションを作成しておけば、以降は認証不要でデータを取得できます。
