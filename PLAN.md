# MissionManagerWeb 構築計画

MissionManager の Web アプリ版を構築するための計画書です。デスクトップ版の機能を踏襲しつつ、Web に最適化した実装を目指します。

---

## 1. 前提・ゴール

### デスクトップ版（MissionManager）の特徴
- **3階層構造**: ジャンル → ミッション → タスク
- **技術**: Python + PySide6、JSON ファイル永続化
- **主要機能**: CRUD、順序変更、期限設定、進捗表示、概要編集
- **UI**: ジャンルプルダウン、ミッションカード、タスクチェックボックス、右クリックメニュー

### Web 版のゴール
- デスクトップ版と同等の機能を提供
- ブラウザ上でどこからでもアクセス可能
- デスクトップ版のデータ形式（JSON）と互換性を維持し、必要に応じてインポート/エクスポート可能
- シンプルで保守しやすい構成

---

## 2. 技術スタック

### 推奨構成（フルスタック）

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フロントエンド | **React** + **TypeScript** | コンポーネント指向、型安全、エコシステム豊富 |
| ビルド | **Vite** | 高速、軽量、設定が簡単 |
| スタイリング | **Tailwind CSS** または **CSS Modules** | 迅速なUI構築 |
| バックエンド | **FastAPI** (Python) | 非同期対応、OpenAPI自動生成、デスクトップ版のロジック共有が容易 |
| ストレージ | **JSON ファイル** (初期) | デスクトップ版との互換性、シンプルな導入 |
| 認証 | なし（初期） | シングルユーザー/ローカル運用を想定 |

### 代替案
- **フロントのみ（SPA + LocalStorage）**: マルチデバイス・サーバー不要なら検討可
- **Next.js**: SSR/SSG が必要な場合
- **Flask**: FastAPI より軽いバックエンドを望む場合

---

## 3. プロジェクト構成

```
MissionManagerWeb/
├── backend/                    # FastAPI バックエンド
│   ├── main.py                 # エントリポイント
│   ├── api/
│   │   ├── genres.py           # ジャンルAPI
│   │   ├── missions.py         # ミッションAPI
│   │   └── tasks.py            # タスクAPI
│   ├── models.py               # データモデル（MissionManagerから移植）
│   ├── storage.py              # JsonStorage（MissionManagerから移植）
│   ├── service.py              # AppService（MissionManagerから移植）
│   ├── data/
│   │   └── app_data.json       # データファイル
│   └── requirements.txt
│
├── frontend/                   # React フロントエンド
│   ├── src/
│   │   ├── components/
│   │   │   ├── GenreSelector.tsx
│   │   │   ├── MissionCard.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── DatePicker.tsx
│   │   ├── api/
│   │   │   └── client.ts       # API クライアント
│   │   ├── hooks/
│   │   │   └── useGenres.ts
│   │   ├── types/
│   │   │   └── index.ts        # 型定義
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── PLAN.md                     # 本計画書
└── README.md
```

---

## 4. API 設計

### データ形式（デスクトップ版と同じ）

```json
{
  "genres": [
    {
      "name": "ジャンル名",
      "summary": "概要（任意）",
      "missions": [
        {
          "name": "ミッション名",
          "tasks": [...],
          "due_date": null,
          "completed_at": null,
          "summary": null
        }
      ]
    }
  ]
}
```

### エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/genres` | 全ジャンル取得 |
| POST | `/api/genres` | ジャンル追加 |
| PATCH | `/api/genres/{i}` | ジャンル更新（名前・概要・順序） |
| DELETE | `/api/genres/{i}` | ジャンル削除 |
| POST | `/api/genres/{i}/missions` | ミッション追加 |
| PATCH | `/api/genres/{gi}/missions/{mi}` | ミッション更新 |
| DELETE | `/api/genres/{gi}/missions/{mi}` | ミッション削除 |
| POST | `/api/genres/{gi}/missions/{mi}/tasks` | タスク追加 |
| PATCH | `/api/genres/{gi}/missions/{mi}/tasks/{ti}` | タスク更新（完了含む） |
| DELETE | `/api/genres/{gi}/missions/{mi}/tasks/{ti}` | タスク削除 |
| POST | `/api/genres/{gi}/move/{direction}` | ジャンル順序変更 (up/down) |
| POST | `/api/genres/{gi}/missions/{mi}/move/{direction}` | ミッション順序変更 |
| POST | `/api/genres/{gi}/missions/{mi}/tasks/{ti}/move/{direction}` | タスク順序変更 |

※ CORS を有効化してフロントエンドからアクセス可能にする。

---

## 5. フロントエンド画面構成

### レイアウト
```
┌─────────────────────────────────────────────────────┐
│ [ジャンル ▼] [追加]                    (概要表示)   │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│ │ ミッションA  │ │ ミッションB  │ │ ミッションC  │     │
│ │ ▓▓▓░░ 60%   │ │ ▓▓▓▓▓ 100%  │ │ □ タスク1   │     │
│ │ 期限: 2/28  │ │ 完了 2/19   │ │ □ タスク2   │     │
│ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                    │
│                        [ミッション追加]             │
└─────────────────────────────────────────────────────┘
```

### コンポーネント仕様
- **GenreSelector**: ジャンル選択 + 「追加」ボタン。未完了ミッション数表示（例: `開発 · 2`）
- **MissionCard**: ミッション名、進捗バー、期限、タスク一覧、クリックでタスク展開/折りたたみ
- **TaskItem**: チェックボックス、タスク名、右クリックでメニュー（名前変更・削除・順序変更）
- **モーダル/ダイアログ**: 名前変更、概要編集、期限編集

---

## 6. 実装フェーズ

### Phase 1: 基盤構築（1〜2日）
- [ ] プロジェクト初期化（Vite + React + FastAPI）
- [ ] `models.py` / `storage.py` / `service.py` を MissionManager からコピー・調整
- [ ] 最小限の API（GET/POST ジャンル、GET/POST ミッション）実装
- [ ] フロントで API 呼び出しとデータ表示の疎通確認

### Phase 2: CRUD 完成（2〜3日）
- [ ] 全エンドポイント実装
- [ ] フロント: ジャンル・ミッション・タスクの一覧・追加・削除・編集
- [ ] 順序変更 API と UI（上へ/下へボタン）
- [ ] タスク完了トグル

### Phase 3: UI 仕上げ（1〜2日）
- [ ] 進捗バー、期限表示、概要表示
- [ ] ミッションカードの展開/折りたたみ
- [ ] ジャンルプルダウンの未完了数表示
- [ ] レスポンシブ対応・見た目の調整

### Phase 4: オプション（必要に応じて）
- [ ] デスクトップ版 JSON のインポート/エクスポート
- [ ] 認証（ログイン）の追加
- [ ] データベース（SQLite 等）への移行

---

## 7. 共有・移植方針

### MissionManager からの再利用
- **models.py**: そのままコピーして使用
- **storage.py**: パスを `MissionManagerWeb/backend/data/` に変更
- **app.py (AppService)**: `service.py` としてコピー、API 層から呼び出し

### コードの共通化（将来的）
- `MissionManager` と `MissionManagerWeb` の親ディレクトリに `missionmanager-core` のような共有パッケージを置き、`models` / `storage` / `service` を共通化する方法も検討可能。

---

## 8. 実行・開発の流れ

```bash
# バックエンド起動
cd MissionManagerWeb/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# フロントエンド起動（別ターミナル）
cd MissionManagerWeb/frontend
npm install
npm run dev
```

- フロント: http://localhost:5173
- API: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs

---

## 9. まとめ

| 項目 | 内容 |
|------|------|
| 推奨スタック | FastAPI + React + TypeScript + Vite |
| データ形式 | JSON（デスクトップ版互換） |
| 実装期間目安 | 約 1 週間（Phase 1〜3） |
| 初回リリース | ローカル/同一ネットワーク内での利用を想定 |

この計画に沿って順次実装を進めることで、デスクトップ版と同等の MissionManager を Web 上で利用できるようになります。
