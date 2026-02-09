---
name: merge-to-main
description: develop を main ブランチにマージする
disable-model-invocation: true
allowed-tools: Bash
---

# develop を main ブランチにマージする

## 手順

### 1. `main` ブランチに切り替える

```bash
git checkout main
```

```bash
git pull origin main
```

### 2. `develop` ブランチの変更をマージする

```bash
git merge develop
```

### 3. リモート `main` にプッシュする

```bash
git push origin main
```

### 4. 完了をユーザーに報告する
