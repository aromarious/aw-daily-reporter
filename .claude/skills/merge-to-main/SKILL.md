---
name: merge-to-main
description: develop を main ブランチにマージする
disable-model-invocation: false
allowed-tools: Bash
---

# develop を main ブランチにマージする

## 手順

### 1. 現在のブランチと状態を確認する

まず、現在の Git 状態を確認する。

```bash
git status
```

### 2. `main` ブランチに切り替えて最新化する

`main` ブランチに切り替えて、リモートから最新の変更を取得する。

```bash
git checkout main && git pull origin main
```

### 3. `develop` ブランチの状態を確認する

`develop` ブランチが最新であることを確認する。

```bash
git fetch origin develop
```

### 4. `develop` ブランチをマージする

**重要**: これは main ブランチへのマージなので、ユーザーに確認してから実行すること。

```bash
git merge origin/develop
```

### 5. リモート `main` にプッシュする

**重要**: main ブランチへのプッシュは慎重に行うこと。ユーザーに最終確認してから実行すること。

```bash
git push origin main
```

### 6. 元のブランチに戻る

作業ブランチ `develop` に戻る。

```bash
git checkout develop
```

### 7. 完了をユーザーに報告する

- `develop` が `main` にマージされたことを報告
- GitHub でのリリース作成を促す（必要に応じて）
