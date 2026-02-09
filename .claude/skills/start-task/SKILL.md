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
gh pr create --base develop --draft --title "WIP: <TASK_NAME>" --body "作業中"
```

- タスク名はユーザーに確認する
- ドラフトPRとして作成することで、レビュー待ちにならないようにする

### 7. 作成完了をユーザーに報告する

- 作成されたブランチ名とPRのURLを伝える
