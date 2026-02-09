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

現在のブランチ名を取得し、`main` や `develop` でないことを確認する。

```bash
git branch --show-current
```

- `main` や `develop` の場合はエラーとして報告し、処理を中断する

### 2. 変更状態を確認する

ステージング状態と変更内容を確認する。

```bash
git status
```

```bash
git diff --staged
```

```bash
git diff
```

### 3. コミット履歴を確認する

このブランチの develop からの差分を確認し、PR タイトルと説明を決定する。

```bash
git log develop..HEAD --oneline
```

```bash
git diff develop...HEAD --stat
```

### 4. 未コミットの変更がある場合はコミットする

未コミットの変更がある場合のみ、コミットを作成する。

- ユーザーにコミットメッセージを確認する
- Conventional Commits に従う
- `Co-Authored-By` を追加する

```bash
git add . && git commit -m "$(cat <<'EOF'
<COMMIT_MESSAGE>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### 5. リモートにプッシュする

リモートブランチが存在するか確認し、適切なプッシュコマンドを実行する。

```bash
git push origin <BRANCH_NAME>
```

### 6. `develop` ブランチに向けたプルリクエストを作成する

PR タイトルと説明を決定し、ユーザーに確認してから作成する。

- タイトル: コミットメッセージや変更内容から生成
- 説明: 変更の概要、テスト方法などを含める
- フッターに「🤖 Generated with [Claude Code](https://claude.com/claude-code)」を追加

```bash
gh pr create --base develop --title "<PR_TITLE>" --body "$(cat <<'EOF'
## Summary
<変更の概要を箇条書きで>

## Test plan
<テスト方法のチェックリスト>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 7. 作成完了をユーザーに報告する

- 作成されたブランチ名と PR の URL を伝える
