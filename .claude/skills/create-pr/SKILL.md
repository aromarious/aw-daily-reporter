---
name: create-pr
description: プルリクエストを作成する
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[commit-message]"
---

# プルリクエストを作成する

## 手順

### 1. 現在のブランチを確認する

```bash
git branch --show-current
```

- `main` や `develop` でないことを確認する

### 2. 変更状態を確認する

```bash
git status
```

### 3. 変更をステージングしてコミットする

- ユーザーにコミットメッセージを確認する

```bash
git add .
git commit -m "<COMMIT_MESSAGE>"
```

### 4. リモートにプッシュする

```bash
git push origin <BRANCH_NAME>
```

### 5. `develop` ブランチに向けたプルリクエストを作成する

```bash
gh pr create --base develop --title "<PR_TITLE>" --body "<PR_DESCRIPTION>"
```

### 6. 作成完了をユーザーに報告する

- 作成された PR の URL を伝える
