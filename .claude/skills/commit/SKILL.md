---
name: commit
description: 変更をコミットする
disable-model-invocation: false
allowed-tools: Bash
---

# 変更をコミットする

## 手順

### 1. 変更状態を確認する

```bash
git status
```

### 2. 変更をコミットする

- **重要**: 既にステージングされている変更がある場合は、`git add .` を実行せず、ステージングされている変更のみをコミットする
- ステージングされている変更がない場合は、`git add .` を実行してからコミットする
- コミットメッセージはユーザーに確認、または Conventional Commits に従って提案する

```bash
# ステージング済みがある場合
git commit -m "<COMMIT_MESSAGE>"

# ステージング済みがない場合
git add .
git commit -m "<COMMIT_MESSAGE>"
```
