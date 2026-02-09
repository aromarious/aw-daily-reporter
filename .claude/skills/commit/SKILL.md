---
name: commit
description: 変更をコミットする
disable-model-invocation: false
allowed-tools: Bash
---

# 変更をコミットする

## 手順

### 1. 変更状態を確認する

現在のステージング状態と変更ファイルを確認する。

```bash
git status
```

```bash
git diff --staged
```

```bash
git diff
```

### 2. コミットメッセージを決定する

- 変更内容を分析し、Conventional Commits に従ったメッセージを提案する
- ユーザーにメッセージを確認する
- メッセージには `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` を追加する

### 3. 変更をコミットする

**重要**: 既にステージングされている変更がある場合は、`git add .` を実行せず、ステージングされている変更のみをコミットすること。

- ステージング済みの変更がある場合:

```bash
git commit -m "$(cat <<'EOF'
<COMMIT_MESSAGE>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

- ステージング済みの変更がない場合:

```bash
git add . && git commit -m "$(cat <<'EOF'
<COMMIT_MESSAGE>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### 4. コミット完了を確認する

```bash
git log -1 --oneline
```

### 5. 完了をユーザーに報告する

- コミットが作成されたことを報告
- コミットメッセージを表示する
