---
name: process-dependabot
description: Dependabot PR を develop ベースの作業ブランチに取り込む
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[PR_NUMBER]"
---

# Dependabot の PR を処理する

## 手順

### 1. Dependabot の PR 一覧を確認する

Dependabot が作成した PR を一覧表示する。

```bash
gh pr list --search "author:app/dependabot" --json number,title,headRefName,url
```

### 2. 処理対象の PR 番号を決定する

- 引数で PR 番号が指定されている場合はそれを使用する
- 指定されていない場合は、ユーザーに処理対象の PR 番号を確認する

### 3. ターゲットの PR からブランチ名とコミット情報を取得する

PR の詳細情報を取得し、ブランチ名とコミットハッシュを確認する。

```bash
gh pr view <PR_NUMBER> --json headRefName,commits,title
```

- コミット数が複数の場合は、すべてのハッシュを記録する

### 4. 作業用ブランチを作成する

`develop` ブランチをベースに新しいブランチを作成する。

```bash
git checkout develop && git pull origin develop
```

- ブランチ名は更新対象のパッケージ名を含める
- 形式: `chore/deps/<package-name>` または `chore/deps/<update-type>`
- PR タイトルから適切な名前を生成し、ユーザーに確認する

```bash
git checkout -b <NEW_BRANCH_NAME>
```

### 5. 更新内容をチェリーピックする

Dependabot のブランチを fetch し、変更をチェリーピックする。

```bash
git fetch origin <DEPENDABOT_BRANCH_NAME>
```

```bash
git cherry-pick <COMMIT_HASH>
```

- 複数のコミットがある場合は、すべてをチェリーピックする
- **重要**: 最終的に1つのコミットにまとめる必要がある場合は、`git rebase -i` または `git commit --amend` を使用する

### 6. ローカルテストを実行する

すべてのテストを実行し、成功することを確認する。

```bash
pnpm lint && pnpm typecheck && pnpm run build:frontend && pnpm test
```

- テストが失敗した場合は、必要な修正を行う

### 7. リモートにプッシュして PR を作成する

ブランチをプッシュし、PR を作成する。

```bash
git push -u origin <NEW_BRANCH_NAME>
```

```bash
gh pr create --base develop --title "chore(deps): <update-description>" --body "$(cat <<'EOF'
## Summary
- Dependabot PR #<ORIGINAL_PR_NUMBER> の変更を取り込み

## Test plan
- [x] ローカルテスト実施済み
- [ ] CI チェック確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 8. CI の実行結果を確認する

作成した PR の CI チェックを監視する。

```bash
gh pr checks <NEW_PR_NUMBER>
```

- すべてのチェックが `pass` になることを確認する
- 失敗した場合は、ユーザーに報告し、修正方法を提案する

### 9. ユーザーにマージ確認を促す

**重要**: マージは自動的に行わず、ユーザーに確認を促すこと。

- CI が成功したことを報告
- マージコマンドを提示するが、ユーザーの承認を待つ

マージコマンド（参考）:

```bash
gh pr merge <NEW_PR_NUMBER> --merge --delete-branch
```

### 10. マージ後の処理（ユーザーがマージを承認した場合）

元の Dependabot PR をクローズし、ブランチを削除する。

```bash
gh pr close <ORIGINAL_PR_NUMBER> --delete-branch --comment "Merged via #<NEW_PR_NUMBER>"
```

ローカル環境を整理する。

```bash
git checkout develop && git pull origin develop
```

```bash
git branch -D <NEW_BRANCH_NAME>
```

```bash
git fetch --prune
```

### 11. 完了をユーザーに報告する

- 処理が完了したことを報告
- 更新された依存関係の概要を伝える
