---
name: complete-pr
description: プルリクエストを完了する（マージ・クリーンアップ）
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "<PR_NUMBER>"
---

# プルリクエストを完了する

## 手順

### 1. プルリクの状態を確認する

```bash
gh pr view <PR_NUMBER> --json State,Mergeable,HeadBranch
```

### 2. CI の実行結果を確認する

```bash
gh pr checks <PR_NUMBER> --watch
```

- すべてのチェックが `pass` になることを確認する

### 3. マージ処理を行う

- まだマージされていない場合:

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- すでにマージ済みの場合:
  - リモートブランチが残っていれば削除する

```bash
git push origin --delete <BRANCH_NAME>
```

### 4. ローカル環境を整理する

- `develop` ブランチに切り替えて最新にする

```bash
git checkout develop && git pull origin develop
```

- ローカルの作業ブランチを削除する

```bash
git branch -D <BRANCH_NAME>
```

- リモートの不要な参照を削除する

```bash
git fetch --prune
```

### 5. 完了をユーザーに報告する

- 「プレビュー環境で確認をお願いします」と伝える
