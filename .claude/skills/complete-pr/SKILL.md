---
name: complete-pr
description: プルリクエストを完了する（マージ・クリーンアップ）
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "<PR_NUMBER>"
---

# プルリクエストを完了する

## 手順

### 1. PR 番号の取得

引数が指定されていない場合、現在のブランチから PR 番号を取得する。

```bash
gh pr view --json number --jq .number
```

### 2. プルリクの状態を確認する

PR の状態、マージ可能性、ブランチ名を取得する。

```bash
gh pr view <PR_NUMBER> --json State,Mergeable,HeadBranch,Title
```

### 3. CI の実行結果を確認する

すべてのチェックが完了し、成功していることを確認する。

```bash
gh pr checks <PR_NUMBER>
```

- すべてのチェックが `pass` でない場合は、ユーザーに確認する

### 4. マージ処理を行う

**重要**: ユーザーに最終確認してからマージを実行すること。

- PR がまだマージされていない場合:

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- すでにマージ済みでリモートブランチが残っている場合:

```bash
git push origin --delete <BRANCH_NAME>
```

### 5. ローカル環境を整理する

`develop` ブランチに切り替えて最新にし、作業ブランチを削除する。

```bash
git checkout develop && git pull origin develop
```

```bash
git branch -D <BRANCH_NAME>
```

```bash
git fetch --prune
```

### 6. 完了をユーザーに報告する

- マージが完了したことを報告
- プレビュー環境やステージング環境での確認を促す（該当する場合）
