---
name: process-dependabot
description: Dependabot PR を develop ベースの作業ブランチに取り込む
disable-model-invocation: true
allowed-tools: Bash
---

# Dependabot の PR を処理する

## 手順

### 1. Dependabot の PR 一覧を確認する

```bash
gh pr list --search "author:app/dependabot" --json number,title,headRefName,url --template '{{range .}}{{tablerow .number .title .headRefName .url}}{{end}}'
```

### 2. ユーザーに処理対象の PR 番号を確認する

- PR 番号を控える

### 3. ターゲットの PR からブランチ名とコミットハッシュを取得する

```bash
gh pr view <PR_NUMBER> --json headRefName,commits --jq '{branch: .headRefName, commit: .commits[0].oid, count: .commits | length}'
```

- ※ コミット数が複数の場合は、すべてのハッシュを控える

### 4. 作業用ブランチを作成する

- `develop` ブランチをベースにする

```bash
git checkout develop
git pull origin develop
```

- 新しいブランチを作成する（ブランチ名は更新対象のパッケージ名などを含める。例: `chore/deps/<package>`）

```bash
git checkout -b <NEW_BRANCH_NAME>
```

### 5. 更新内容をチェリーピックする

- Dependabot のブランチを fetch する

```bash
git fetch origin <DEPENDABOT_BRANCH_NAME>
```

- チェリーピックを実行する

```bash
git cherry-pick <COMMIT_HASH>
```

- **要件: 1つのコミットにする**
  - チェリーピックしたコミットが1つであればそのままで OK
  - 複数ある場合、またはメッセージを整理したい場合は `git commit --amend` や `git rebase -i` を使用して整える

### 6. ローカルテストを実行する

```bash
pnpm lint; pnpm typecheck; pnpm run build:frontend; pnpm test
```

- すべてのテストが通ることを確認する

### 7. PR を作成する

```bash
gh pr create --base develop --title "chore(deps): update dependencies" --body "DependabotのPRを取り込みました。"
```

### 8. CI の実行結果を確認する

```bash
gh pr checks <PR_NUMBER> --watch
```

- すべてのチェックが `pass` になることを確認する

### 9. `develop` ブランチにマージする

```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
```

### 10. Dependabot の元の PR をクローズし、ブランチを削除する

```bash
gh pr close <ORIGINAL_PR_NUMBER> --delete-branch
```

### 11. 完了をユーザーに報告する
