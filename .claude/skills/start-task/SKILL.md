---
name: start-task
description: 新しく作業を始める時、まずブランチとPRを作成する
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[branch-name]"
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
- issue のタイトルからブランチ名とPRタイトルを生成する
- issue の情報を後続の手順で使用する

### 1. 現在のブランチを確認する

```bash
git branch --show-current
```

- `develop` ブランチにいることを確認する
- `develop` でない場合は、`develop` に切り替える

### 2. developブランチを最新にする

```bash
git pull origin develop
```

### 3. 作業用ブランチを作成してスイッチする

```bash
git checkout -b <BRANCH_NAME>
```

- ブランチ名の形式: `feature/<task-name>` または `fix/<issue-name>`
- issue番号が指定された場合は、issueのタイトルから適切なブランチ名を生成する
  - 例: issue #123 "Add dark mode support" → `feature/123-add-dark-mode-support`
- ユーザーにブランチ名を確認する

### 4. 空のコミットを作成する

```bash
git commit --allow-empty -m "wip: start implementation"
```

### 5. リモートにプッシュする

```bash
git push -u origin <BRANCH_NAME>
```

### 6. `develop` ブランチに向けたドラフトPRを作成する

```bash
gh pr create --base develop --draft --title "WIP: <TASK_NAME>" --body "<BODY>"
```

- issue番号が指定された場合:
  - PRタイトル: `WIP: <issueのタイトル>`
  - PR本文: issue番号へのリンクと簡単な説明を含める
    - 例: `Closes #123\n\n<issueの本文または要約>`
- issue番号が指定されていない場合:
  - タスク名はユーザーに確認する
  - 本文は「作業中」とする
- ドラフトPRとして作成することで、レビュー待ちにならないようにする

### 7. 作成完了をユーザーに報告する

- 作成されたブランチ名とPRのURLを伝える
