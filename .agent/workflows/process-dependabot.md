---
description: DependabotのPRをdevelopベースの作業ブランチに取り込み、ローカルテストを実行する
---

1. DependabotのPR一覧を確認します。
   // turbo
   ```bash
   gh pr list --search "author:app/dependabot" --json number,title,headRefName,url --template '{{range .}}{{tablerow .number .title .headRefName .url}}{{end}}'
   ```

2. ユーザーに処理対象のPR番号を確認します。
   - PR番号を控えてください。

3. ターゲットのPRからブランチ名とコミットハッシュを取得します。
   // turbo
   ```bash
   gh pr view <PR_NUMBER> --json headRefName,commits --jq '{branch: .headRefName, commit: .commits[0].oid, count: .commits | length}'
   ```
   - ※ コミット数が複数の場合は、すべてのハッシュを控えてください。

4. 作業用ブランチを作成します。
   - `develop` ブランチをベースにします。
   ```bash
   git checkout develop
   git pull origin develop
   ```
   - 新しいブランチを作成します。ブランチ名は更新対象のパッケージ名などを含めます。(例: `chore/deps/<package>`)
   ```bash
   git checkout -b <NEW_BRANCH_NAME>
   ```

5. 更新内容をチェリーピックします。
   - Dependabotのブランチをfetchします。
   ```bash
   git fetch origin <DEPENDABOT_BRANCH_NAME>
   ```
   - チェリーピックを実行します。
   ```bash
   git cherry-pick <COMMIT_HASH>
   ```
   - **要件: 1つのコミットにする**
     - チェリーピックしたコミットが1つであればそのままでOKです。
     - 複数ある場合、またはメッセージを整理したい場合は `git commit --amend` や `git rebase -i` を使用して整えてください。

6. ローカルテストを実行します。
   ```bash
   pnpm lint; pnpm typecheck; pnpm run build:frontend; pnpm test
   ```
   - すべてのテストが通ることを確認してください。

7. PRを作成します。
   ```bash
   gh pr create --base develop --title "chore(deps): update dependencies" --body "DependabotのPRを取り込みました。"
   ```

8. CIの実行結果を確認します。
   // turbo
   ```bash
   gh pr checks <PR_NUMBER> --watch
   ```
   - すべてのチェックが `pass` になることを確認します。

9. `develop` ブランチにマージします。
   ```bash
   gh pr merge <PR_NUMBER> --merge --delete-branch
   ```

10. Dependabotの元のPRをクローズし、ブランチを削除します。
    ```bash
    gh pr close <ORIGINAL_PR_NUMBER> --delete-branch
    ```

11. 完了をユーザーに報告します。
