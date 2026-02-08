# フロントエンドテスト戦略 (Frontend Testing Strategy)

このドキュメントでは、`aw-daily-reporter` のフロントエンド固有のテスト方針を定義します。

## 1. テストの目的

- **信頼性の向上**: リファクタリングや機能追加時の回帰バグを防ぐ。
- **仕様の文書化**: テストコード自体が仕様書としての役割を果たす。
- **開発効率**: バグの早期発見により、手戻りを減らす。

## 2. テスト対象と優先度

### ✅ High Priority (必ずテストする)

論理的に複雑で、バグが混入しやすい部分。

- **ユーティリティ関数 (`src/lib/*.ts`)**
  - 純粋関数が多く、入力に対する出力が明確なためテストしやすく、効果が高い。
  - 例: `colors.ts` (境界値分析、異常系を含む)
- **カスタムフック (`src/hooks/*.ts`)**
  - 複雑なステート管理やロジックを持つ場合。
  - 例: データの加工、フィルタリングロジックなど。

### ⚠️ Medium Priority (重要度に応じてテストする)

UIの振る舞いや、コンポーネント間の連携。

- **共有UIコンポーネント (`src/components/*.tsx`)**
  - **ロジックを持つもの**: `ThemeToggle` (テーマ切り替え), `TagInput` (タグ追加・削除) など。
  - **インタラクションがあるもの**: ボタンクリックでハンドラが呼ばれるか、条件によって表示が変わるか。
  - **単なる表示のみのコンポーネントは優先度を下げる**。

- **Context Providers (`src/contexts/*.tsx`)**
  - アプリケーション全体に影響する状態管理ロジックがある場合。

### ❌ Low Priority / Out of Scope (ユニットテストでは対象外)

コスト対効果が低い、または他の手段（E2Eなど）が適している部分。

- **ページコンポーネント (`src/app/**/*.tsx`)**
  - ルーティングやデータフェッチが絡むため、ユニットテストは複雑になりがち。
  - これらは将来的に **E2Eテスト (Playwrightなど)** でカバーする方が効率的。
- **サードパーティライブラリの機能**
  - `next/link`, `clsx`, `lucide-react` 自体の動作確認は不要。
- **設定ファイル**
  - `tailwind.config.ts`, `vitest.config.ts` など。
- **単純なUIコンポーネント**
  - `Card.tsx` のような、単に `children` をラップしてスタイルを当てるだけのコンポーネント。
  - これらは Storybook や VRT (Visual Regression Testing) の領域。

## 3. 具体的な判断基準

| ディレクトリ      | ファイル例        | テスト方針 | 理由                                                          |
| :---------------- | :---------------- | :--------- | :------------------------------------------------------------ |
| `src/lib/`        | `colors.ts`       | **必須**   | 純粋なロジックであり、アプリ全体で使われるため。              |
| `src/lib/`        | `api.ts`          | **推奨**   | APIクライアントの挙動（エラーハンドリング等）を確認するため。 |
| `src/hooks/`      | `useTimeline.ts`  | **必須**   | データ加工ロジックが集中するため。                            |
| `src/components/` | `ThemeToggle.tsx` | **推奨**   | ユーザーアクションによる状態変化があるため。                  |
| `src/components/` | `Header.tsx`      | 対象外     | 主にレイアウトのみであり、ロジックが薄いため。                |
| `src/app/`        | `page.tsx`        | 対象外     | 統合テスト/E2Eの領域であるため。                              |

## 4. テスト実装のルール

## 5. コンポーネント/モジュール別テスト計画

現在のコードベースにおける各ファイルのテスト方針一覧です。

### `src/lib` (Utilities)

| ファイル    | 優先度   | 理由・方針                                              |
| :---------- | :------- | :------------------------------------------------------ |
| `colors.ts` | **High** | 色生成ロジック。境界値テスト実装済み。                  |
| `api.ts`    | **High** | APIクライアント。エラーハンドリングを中心にテスト推奨。 |

### `src/hooks` (Custom Hooks)

| ファイル           | 優先度   | 理由・方針                           |
| :----------------- | :------- | :----------------------------------- |
| `useChartTheme.ts` | **High** | テーマに応じたチャート設定ロジック。 |

### `src/contexts` (Contexts)

| ファイル           | 優先度 | 理由・方針                 |
| :----------------- | :----- | :------------------------- |
| `I18nContext.tsx`  | Medium | 言語切り替えロジック。     |
| `ToastContext.tsx` | Medium | 通知の追加・削除ロジック。 |

### `src/components` (Components)

重点テスト対象 (Interaction/Logic)

| ファイル                | 優先度 | 理由・方針                                   |
| :---------------------- | :----- | :------------------------------------------- |
| `ThemeToggle.tsx`       | Medium | テーマ切り替えインタラクション。実装済み。   |
| `TagInput.tsx`          | Medium | タグの追加・削除・バリデーションロジック。   |
| `RuleModal.tsx`         | Medium | フォーム入力、バリデーション、送信ロジック。 |
| `ConfigInitializer.tsx` | Medium | 初期化ロジック（`useEffect`）の確認。        |

表示・レイアウト中心 (Low Priority / VRT or E2E recommended)

- `Header.tsx`, `NoSSRHeader.tsx`
- `Card.tsx`
- `CategoryList.tsx`, `ClientList.tsx`, `RuleList.tsx` (リスト表示はE2Eでデータ連携ごと確認)
- `TimelineTable.tsx`, `table/DataTable.tsx`
- `pipeline/*` (デバッグ用コンポーネント群)

外部ライブラリラッパー (Low Priority)

- `echarts/*` (Canvas描画のため単体テストは困難・非推奨)
- `NoSSR.tsx`

### `src/app` (Pages/Layouts)

全件 Low Priority (E2E対象)

- `layout.tsx`, `page.tsx`
- `settings/page.tsx`, `colors/page.tsx`, `debugger/page.tsx`

- **AAAパターン (Arrange-Act-Assert)** を守る。
- **命名規則**: `test_<Target>_<Scenario>_<Expected>`
- **カバレッジ目標**: `src/lib`, `src/hooks` は **80%以上** を目指す。UIは数値目標を置かず、重要なパスをカバーすることに注力する。
