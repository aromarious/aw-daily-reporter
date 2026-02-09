---
name: start-task
description: 新しく作業を始める時、まずブランチとPRを作成する
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[issue番号 または タスク内容]"
---

# 新しく作業を始める

新しく作業を始める時、最初にこれらを実行します。

## 手順

### 0. 引数が番号の場合は issue を参照する

引数が数字（例: `123`）の場合、GitHub issue として扱う。

```bash
gh issue view <ISSUE_NUMBER>
```

- issue のタイトル、本文、ラベルを確認する
- ラベルから issue の種類を判断する（`bug` ラベルがあれば bugfix、なければ feature）
- issue のタイトルとラベルからブランチ名と PR タイトルを生成する
- issue の情報を後続の手順で使用する

### 1. 現在のブランチを確認する

現在のブランチ名を取得し、必要に応じて `develop` に切り替える。

```bash
git branch --show-current
```

- `develop` でない場合は、`develop` に切り替える

```bash
git checkout develop
```

### 2. develop ブランチを最新にする

リモートから最新の変更を取得する。

```bash
git pull origin develop
```

### 3. ブランチ名を決定する

ブランチ名は git-flow に従った形式で生成する。

- issue 番号が指定された場合は、issue のタイトルとラベルから適切なブランチ名を生成する
  - 新機能: `feature/<issue-number>-<slug>`
  - バグ修正: `bugfix/<issue-number>-<slug>`
  - 例: issue #123 "Add dark mode support" → `feature/123-add-dark-mode-support`
- タスク内容（日本語テキスト）が指定された場合は、内容を分析してブランチ名を生成する
  - 新機能: `feature/<slug>`
  - バグ修正: `bugfix/<slug>`
  - 例: "ダークモード対応を追加" → `feature/add-dark-mode-support`
  - 例: "ログイン画面のバグ修正" → `bugfix/fix-login-page-bug`
- 引数がない場合はユーザーに確認する

### 4. 作業用ブランチを作成してスイッチする

新しいブランチを作成して切り替える。

```bash
git checkout -b <BRANCH_NAME>
```

### 5. 空のコミットを作成する

WIP コミットを作成する。

```bash
git commit --allow-empty -m "wip: start implementation"
```

### 6. リモートにプッシュする

新しいブランチをリモートに push し、トラッキングを設定する。

```bash
git push -u origin <BRANCH_NAME>
```

### 7. `develop` ブランチに向けたドラフト PR を作成する

ドラフト PR を作成する。これによりレビュー待ちにならないようにする。

- issue 番号が指定された場合:
  - PR タイトル: `WIP: <issue のタイトル>`
  - PR 本文: issue 番号へのリンクと簡単な説明を含める

```bash
gh pr create --base develop --draft --title "WIP: <TASK_NAME>" --body "$(cat <<'EOF'
Closes #<ISSUE_NUMBER>

<issue の概要>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- issue 番号が指定されていない場合:
  - タスク名はユーザーに確認する
  - 本文は「作業中」とする

```bash
gh pr create --base develop --draft --title "WIP: <TASK_NAME>" --body "$(cat <<'EOF'
作業中

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 8. 作成完了をユーザーに報告する

- 作成されたブランチ名と PR の URL を伝える
- 次のステップ（実装開始）を提案する
