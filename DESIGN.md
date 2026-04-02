# MissionManagerWeb 設計書

本ドキュメントは、設計検討を踏まえて決定した内容をまとめたものです。

---

## 1. アーキテクチャ概要

```
[Vercel]
├── フロントエンド (Next.js App Router + React)
└── API (Next.js API Routes / Route Handlers)
         ↓
[Neon] PostgreSQL
```

- **デプロイ**: Vercel のみ（フロント・API を同一プロジェクトでホスト）
- **データベース**: Neon（PostgreSQL）
- **バックエンド言語**: TypeScript（Python は使用しない）

---

## 2. 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| データベース | Neon (PostgreSQL) |
| ORM/DB接続 | Prisma または Drizzle / node-postgres |
| デプロイ | Vercel |

---

## 3. データモデル

### リソースと ID

全リソースに UUID を付与。デスクトップ版の JSON とは構造が異なる（Web 用に再設計）。

### エンティティ

| エンティティ | 主キー | 主要フィールド |
|--------------|--------|----------------|
| Genre | id (UUID) | name, summary, order |
| Mission | id (UUID) | genre_id, name, summary, due_date, completed_at, order |
| Task | id (UUID) | mission_id, name, done, completed_at, due_date, order |

### PostgreSQL スキーマ（案）

```sql
-- genres
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR NOT NULL,
summary TEXT,
"order" INT NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT now()

-- missions
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
name VARCHAR NOT NULL,
summary TEXT,
due_date DATE,
completed_at TIMESTAMPTZ,
"order" INT NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT now()

-- tasks
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
name VARCHAR NOT NULL,
done BOOLEAN NOT NULL DEFAULT false,
completed_at TIMESTAMPTZ,
due_date DATE,
"order" INT NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ DEFAULT now()
```

---

## 4. API 設計

### URL 構成

階層型。リソースは ID（UUID）で指定。

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/genres` | 全ジャンル取得 |
| POST | `/api/genres` | ジャンル追加 |
| PATCH | `/api/genres/[id]` | ジャンル更新 |
| DELETE | `/api/genres/[id]` | ジャンル削除 |
| POST | `/api/genres/[id]/move/up` | ジャンルを上へ |
| POST | `/api/genres/[id]/move/down` | ジャンルを下へ |
| GET | `/api/genres/[id]/missions` | ジャンルのミッション一覧 |
| POST | `/api/genres/[id]/missions` | ミッション追加 |
| PATCH | `/api/missions/[id]` | ミッション更新 |
| DELETE | `/api/missions/[id]` | ミッション削除 |
| POST | `/api/missions/[id]/move/up` | ミッションを上へ |
| POST | `/api/missions/[id]/move/down` | ミッションを下へ |
| GET | `/api/missions/[id]/tasks` | ミッションのタスク一覧 |
| POST | `/api/missions/[id]/tasks` | タスク追加 |
| PATCH | `/api/tasks/[id]` | タスク更新（完了含む） |
| POST | `/api/tasks/[id]/move/up` | タスクを上へ |
| POST | `/api/tasks/[id]/move/down` | タスクを下へ |
| DELETE | `/api/tasks/[id]` | タスク削除 |

---

## 5. フロントエンド設計

### 状態管理

- カスタムフック（`useGenres` など）で取得・再取得・更新を集約
- ジャンル一覧などはフック経由で管理

### コンポーネント責務

| コンポーネント | 責務 |
|----------------|------|
| GenreSelector | ジャンル選択プルダウン、未完了ミッション数表示、追加ボタン |
| MissionCard | ミッション表示、進捗バー、期限、タスク一覧、展開/折りたたみ（内部 state） |
| TaskItem | チェックボックス、タスク名、アイコンボタンでメニュー |
| Modal | 名前変更・概要編集・期限編集の入力 |

### UI 仕様

| 項目 | 決定 |
|------|------|
| タスク展開/折りたたみ | 各 MissionCard 内で state を保持 |
| 操作メニュー | アイコンボタン（三点リーダー等）。右クリックメニューは使わない |
| 入力方式 | モーダル（ダイアログ） |
| 進捗計算 | フロントで計算（完了数/総数） |
| 期限表示 | 日本語表記（`2024年12月31日`） |
| レイアウト | リスト（縦積み） |

---

## 6. プロジェクト構成

```
MissionManagerWeb/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/
│   │   ├── genres/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── move/
│   │   │           └── [direction]/route.ts
│   │   ├── genres/[id]/missions/
│   │   │   └── route.ts
│   │   ├── missions/
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── move/
│   │   │       └── [direction]/route.ts
│   │   ├── missions/[id]/tasks/
│   │   │   └── route.ts
│   │   └── tasks/
│   │       └── [id]/
│   │           ├── route.ts
│   │           └── move/
│   │               └── [direction]/route.ts
│   └── globals.css
├── components/
│   ├── GenreSelector.tsx
│   ├── MissionCard.tsx
│   ├── TaskItem.tsx
│   ├── Modal.tsx
│   └── ProgressBar.tsx
├── hooks/
│   └── useGenres.ts
├── lib/
│   ├── db.ts          # Neon 接続
│   └── types.ts       # 型定義
├── prisma/            # Prisma 使用時
│   └── schema.prisma
├── DESIGN.md
├── PLAN.md
├── package.json
└── next.config.js
```

注: 従来の `backend/` は Next.js に統合するため廃止。

---

## 7. 環境変数

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | Neon 接続文字列 |

Vercel と Neon のダッシュボードで設定。

---

## 8. デプロイ

1. GitHub にリポジトリを push
2. Vercel でプロジェクトをインポート
3. Neon で PostgreSQL を作成し、`DATABASE_URL` を Vercel に設定
4. デプロイ実行

---

## 9. 設計決定サマリー

| 項目 | 決定 |
|------|------|
| 構成 | Next.js + Neon |
| デプロイ | Vercel のみ |
| データベース | Neon (PostgreSQL) |
| リソース指定 | ID (UUID) |
| URL構成 | 階層型 |
| 順序変更 | 専用エンドポイント |
| 状態管理 | カスタムフック |
| タスク展開 | 各 MissionCard 内で持つ |
| 操作メニュー | アイコンボタン |
| 入力 | モーダル |
| 進捗 | フロントで計算 |
| 期限表示 | 日本語表記 |
| レイアウト | リスト（縦積み） |
